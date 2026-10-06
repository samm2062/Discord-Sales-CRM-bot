// Thin wrapper around Discord's REST API (v10), used for anything the bot
// does outside the immediate interaction response — posting to channels,
// creating a rep's private channel, assigning roles, editing a deferred reply.

const API = "https://discord.com/api/v10";

function headers(env) {
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function call(env, path, options = {}) {
  const res = await fetch(`${API}${path}`, { ...options, headers: headers(env) });
  if (!res.ok) {
    throw new Error(`Discord API ${options.method || "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function sendChannelMessage(env, channelId, payload) {
  return call(env, `/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// Edits the original response to a deferred interaction. Use this from
// ctx.waitUntil() work after returning a type-5 (deferred) response.
export function editOriginalResponse(env, interactionToken, payload) {
  return call(env, `/webhooks/${env.DISCORD_APPLICATION_ID}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function addGuildMemberRole(env, userId, roleId) {
  return call(env, `/guilds/${env.GUILD_ID}/members/${userId}/roles/${roleId}`, { method: "PUT" });
}

// VIEW_CHANNEL (1024) + SEND_MESSAGES (2048) + READ_MESSAGE_HISTORY (65536).
// Explicit and complete on purpose: whoever gets this can see the channel,
// see every message ever posted in it (not just new ones from the moment
// they got access), and post in it.
const DESK_CHANNEL_ACCESS = "68608";

// Creates a private text channel under MY_DESK_CATEGORY_ID, visible only to
// the given user and the admin role. Returns the created channel object.
export function createDeskChannel(env, userId, channelName) {
  return call(env, `/guilds/${env.GUILD_ID}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0, // GUILD_TEXT
      parent_id: env.MY_DESK_CATEGORY_ID,
      permission_overwrites: [
        { id: env.GUILD_ID, type: 0, deny: "1024" }, // @everyone: deny VIEW_CHANNEL (denies everything else downstream too, since they can't see in)
        { id: userId, type: 1, allow: DESK_CHANNEL_ACCESS }, // the rep who owns this desk
        { id: env.ADMIN_ROLE_ID, type: 0, allow: DESK_CHANNEL_ACCESS }, // every admin
        // the bot's own user (bot user ID == application ID) — not automatically
        // exempt just for creating the channel, needs its own explicit allow.
        // Redundant now that the bot's role has server-wide Administrator, but
        // kept so this channel is still correct even if that ever changes.
        { id: env.DISCORD_APPLICATION_ID, type: 1, allow: DESK_CHANNEL_ACCESS },
      ],
    }),
  });
}

export function addReaction(env, channelId, messageId, emoji) {
  return call(env, `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
    method: "PUT",
  });
}
