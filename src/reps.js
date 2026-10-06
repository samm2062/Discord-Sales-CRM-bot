import { findRows, rowToObject } from "./sheets.js";
import { sendChannelMessage } from "./discordApi.js";

// Looks up a rep's row in the Reps tab by their Discord ID. Returns
// { discord_id, name, role, status, start_date, desk_channel_id } or null.
export async function getRep(env, discordId) {
  const matches = await findRows(env, "Reps", "discord_id", discordId);
  if (matches.length === 0) return null;
  return rowToObject(matches[0].header, matches[0].values);
}

// Posts into a rep's own private desk channel, if they have one on file.
// Silently does nothing if the rep can't be found (e.g. not yet /verify'd) —
// callers shouldn't fail over one missing channel.
export async function notifyDesk(env, discordId, payload) {
  const rep = await getRep(env, discordId);
  if (!rep || !rep.desk_channel_id) return;
  await sendChannelMessage(env, rep.desk_channel_id, payload);
}
