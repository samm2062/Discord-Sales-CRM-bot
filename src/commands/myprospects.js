import { getRows } from "../sheets.js";
import { todayISO, daysBetween } from "../config.js";

function nextFollowup(header, row) {
  for (const slot of [1, 2, 3]) {
    const doneIdx = header.indexOf(`followup${slot}_done`);
    if (row[doneIdx] !== "true") {
      const dateIdx = header.indexOf(`followup${slot}_date`);
      return { slot, date: row[dateIdx] };
    }
  }
  return null;
}

export default async function myprospects(env, interaction) {
  const user = interaction.member.user;
  const { header, rows } = await getRows(env, "Prospects");
  const ownerIdx = header.indexOf("owner_discord_id");
  const nameIdx = header.indexOf("prospect");
  const statusIdx = header.indexOf("status");

  const mine = rows.filter((r) => r[ownerIdx] === user.id);
  if (mine.length === 0) {
    return { flags: 64, content: "You don't have any prospects yet. Start one with `/newprospect`." };
  }

  const today = todayISO();
  const lines = mine.map((r) => {
    const next = nextFollowup(header, r);
    let followupText = "all follow-ups done";
    if (next) {
      const daysUntil = daysBetween(today, next.date);
      followupText =
        daysUntil < 0
          ? `⚠️ Follow-up ${next.slot} overdue by ${-daysUntil}d`
          : daysUntil === 0
            ? `Follow-up ${next.slot} due today`
            : `Follow-up ${next.slot} due in ${daysUntil}d`;
    }
    return `**${r[nameIdx]}** — ${r[statusIdx]} — ${followupText}`;
  });

  return {
    flags: 64,
    content: `Your prospects (${mine.length}):\n${lines.join("\n")}`,
  };
}
