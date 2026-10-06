import { verifyKey, InteractionType, InteractionResponseType } from "discord-interactions";
import { handlers } from "./commands/index.js";
import { editOriginalResponse, addReaction } from "./discordApi.js";
import { isFollowupButton, handleFollowupButton } from "./followupButtons.js";
import {
  postMorningPrompt,
  sweepAttendance,
  followupSweep,
  dmQuotaSweep,
  weeklyRollup,
  postLeaderboard,
  announceWeeklyWinner,
} from "./cron.js";

// Commands whose replies should be private to the caller. Discord fixes
// ephemeral-ness at the initial deferred response — it can't be changed on
// the later edit, so this has to be decided before calling the handler.
const EPHEMERAL_COMMANDS = new Set([
  "help",
  "checkin",
  "excuse",
  "newprospect",
  "followup",
  "myprospects",
  "handover",
  "handoverall",
  "report",
  "batches",
  "verify",
]);

async function handleInteraction(env, ctx, interaction) {
  if (interaction.type === InteractionType.PING) {
    return json({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    const customId = interaction.data.custom_id;
    if (isFollowupButton(customId)) {
      // Deferred UPDATE (type 6), not a new reply — this edits the original
      // nudge message in place once the background work finishes, same
      // ack-now/edit-later pattern as slash commands.
      ctx.waitUntil(
        handleFollowupButton(env, interaction)
          .then((payload) => editOriginalResponse(env, interaction.token, payload))
          .catch(async (err) => {
            console.error(err);
            await editOriginalResponse(env, interaction.token, {
              content: `Something went wrong: ${err.message}`,
              components: [],
            });
          })
      );
      return json({ type: 6 });
    }
    return json({ type: 6 });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const commandName = interaction.data.name;
    const handler = handlers[commandName];
    if (!handler) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: "Unknown command.", flags: 64 },
      });
    }

    // #leaderboard is a display-only channel — every command except
    // /leaderboard itself is blocked there, so other commands' output (e.g.
    // /standup's card) can't clutter it up.
    if (commandName !== "leaderboard" && interaction.channel_id === env.LEADERBOARD_CHANNEL_ID) {
      return json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: `This channel is for \`/leaderboard\` only — run \`/${commandName}\` somewhere else.`, flags: 64 },
      });
    }

    // Ack immediately (Discord requires a response within 3s), then do the
    // real work (Sheets/Discord API calls) in the background and edit the
    // deferred reply once it's done.
    ctx.waitUntil(
      handler(env, interaction)
        .then(async (payload) => {
          // eslint-disable-next-line no-unused-vars
          const { react, flags, ...messagePayload } = payload;
          const message = await editOriginalResponse(env, interaction.token, messagePayload);
          if (react && message?.channel_id && message?.id) {
            await addReaction(env, message.channel_id, message.id, react);
          }
        })
        .catch(async (err) => {
          console.error(err);
          await editOriginalResponse(env, interaction.token, {
            content: `Something went wrong: ${err.message}`,
          });
        })
    );

    return json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: EPHEMERAL_COMMANDS.has(commandName) ? { flags: 64 } : undefined,
    });
  }

  return json({ type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: "Unsupported interaction." } });
}

function json(body) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "POST") {
      return new Response("Sales Discord CRM bot is running.", { status: 200 });
    }

    const signature = request.headers.get("X-Signature-Ed25519");
    const timestamp = request.headers.get("X-Signature-Timestamp");
    const body = await request.text();

    const isValid = signature && timestamp && (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
    if (!isValid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body);
    return handleInteraction(env, ctx, interaction);
  },

  async scheduled(event, env, ctx) {
    switch (event.cron) {
      case "15 3 * * 1-5,7":
        ctx.waitUntil(postMorningPrompt(env));
        break;
      case "15 8 * * 1-5,7":
        ctx.waitUntil(Promise.all([sweepAttendance(env), followupSweep(env)]));
        break;
      case "15 14 * * 1-5,7":
        ctx.waitUntil(dmQuotaSweep(env));
        break;
      case "30 14 * * 1-5,7":
        ctx.waitUntil(postLeaderboard(env));
        break;
      case "15 11 * * 6":
        // Same trigger fires both the admin weekly rollup and the public
        // leaderboard winner reveal — free Cloudflare plan caps accounts at
        // 5 cron triggers total, so these two "end of week" reports share
        // one slot instead of each getting their own.
        ctx.waitUntil(Promise.all([weeklyRollup(env), announceWeeklyWinner(env)]));
        break;
    }
  },
};
