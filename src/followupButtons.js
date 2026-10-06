import { logFollowup } from "./prospects.js";
import { appendRow } from "./sheets.js";

const PREFIX = "fu";
// The common day-to-day outcomes — anything needing more (closing a deal,
// custom notes) still goes through /followup, which has room for deal
// stage and revenue. custom_id format: "fu|<outcome>|<prospect_id>" — the
// prospect_id is last and un-split so it's safe even if it ever contains a
// "|" itself.
const QUICK_OUTCOMES = [
  { outcome: "Replied", style: 3 }, // green
  { outcome: "Seen, No Reply", style: 2 }, // grey
  { outcome: "No Response", style: 2 }, // grey
];

export function followupButtons(prospectId) {
  return [
    {
      type: 1, // ACTION_ROW
      components: QUICK_OUTCOMES.map(({ outcome, style }) => ({
        type: 2, // BUTTON
        style,
        label: outcome,
        custom_id: `${PREFIX}|${outcome}|${prospectId}`,
      })),
    },
  ];
}

export function isFollowupButton(customId) {
  return typeof customId === "string" && customId.startsWith(`${PREFIX}|`);
}

// Handles a click on one of the quick-outcome buttons: logs it exactly like
// /followup would (same points, same quota credit, same sheet writes), then
// returns a payload to replace the original message with a confirmation and
// no more buttons (so it can't be double-clicked).
export async function handleFollowupButton(env, interaction) {
  const [, outcome, ...rest] = interaction.data.custom_id.split("|");
  const prospectId = rest.join("|");
  const user = interaction.member.user;
  const name = user.global_name || user.username;

  const result = await logFollowup(env, prospectId, {
    outcome,
    notes: "Logged via quick-action button on the follow-up reminder.",
    dealStage: null,
    revenue: null,
  });

  if (!result) {
    return {
      content: `⚠️ Couldn't find that prospect anymore — it may have already been handled. Use \`/followup\` if you still need to log it.`,
      components: [],
    };
  }

  await appendRow(env, "DailyLogs", [
    new Date().toISOString(),
    user.id,
    "followup",
    outcome,
    "Logged via quick-action button",
    "",
    prospectId,
    name,
  ]);

  const { obj, completedSlot } = result;
  return {
    content: `✅ Follow-up logged for **${obj.prospect}** — outcome: ${outcome}${
      completedSlot ? ` (follow-up ${completedSlot} of 3 marked done)` : ""
    }.`,
    components: [],
  };
}
