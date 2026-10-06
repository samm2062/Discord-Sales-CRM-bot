import { appendRow } from "../sheets.js";
import { markAttendance } from "../attendance.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name)?.value ?? "";
}

export default async function standup(env, interaction) {
  const user = interaction.member.user;
  const dmsYesterday = getOption(interaction, "dms_yesterday");
  const today = getOption(interaction, "today");
  const blockers = getOption(interaction, "blockers");

  const name = user.global_name || user.username;
  await markAttendance(env, user.id, name);
  await appendRow(env, "DailyLogs", [
    new Date().toISOString(),
    user.id,
    "standup",
    today,
    blockers,
    "",
    "",
    name,
    dmsYesterday,
  ]);

  const embed = {
    title: `Stand-up — ${name}`,
    color: 0x5865f2,
    fields: [
      { name: "DMs yesterday", value: String(dmsYesterday), inline: true },
      { name: "Today", value: today },
      { name: "Blockers", value: blockers },
    ],
    timestamp: new Date().toISOString(),
  };

  await notifyDesk(env, user.id, { embeds: [embed] });

  return { embeds: [embed] };
}
