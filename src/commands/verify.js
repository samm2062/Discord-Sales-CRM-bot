import { appendRow, findRows } from "../sheets.js";
import { addGuildMemberRole, createDeskChannel } from "../discordApi.js";
import { todayISO } from "../config.js";

export default async function verify(env, interaction) {
  const user = interaction.member.user;
  const existing = await findRows(env, "Reps", "discord_id", user.id);
  if (existing.length > 0) {
    return { flags: 64, content: "You're already verified." };
  }

  await addGuildMemberRole(env, user.id, env.REP_ROLE_ID);

  const channelName = `desk-${(user.global_name || user.username).toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
  const channel = await createDeskChannel(env, user.id, channelName);

  await appendRow(env, "Reps", [
    user.id,
    user.global_name || user.username,
    "rep",
    "active",
    todayISO(),
    channel.id,
  ]);

  return {
    flags: 64,
    content: `Welcome aboard! You've got the Rep role and your own space: <#${channel.id}>.`,
  };
}
