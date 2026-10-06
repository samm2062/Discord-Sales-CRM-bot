import { appendRow, findRows, updateRow, rowToObject } from "./sheets.js";
import { todayISO } from "./config.js";

// Records today's excuse and marks today's Attendance row as "excused" —
// unless the rep is already genuinely "present" (an excuse given after a
// real check-in doesn't downgrade it). This is what protects a rep from
// both the no-show strike and the DM-quota strike for today.
export async function submitExcuse(env, discordId, name, reason) {
  const today = todayISO();
  const now = new Date().toISOString();

  const existing = await findRows(env, "Attendance", "date", today);
  const mine = existing.find((r) => rowToObject(r.header, r.values).discord_id === discordId);

  if (!mine) {
    await appendRow(env, "Attendance", [today, discordId, "excused", now, name]);
  } else {
    const obj = rowToObject(mine.header, mine.values);
    if (obj.status !== "present") {
      await updateRow(env, "Attendance", mine._row, [today, discordId, "excused", now, name]);
    }
  }

  await appendRow(env, "Excuses", [today, discordId, reason, now, name]);
}

export async function hasExcuseToday(env, discordId) {
  const today = todayISO();
  const rows = await findRows(env, "Excuses", "date", today);
  return rows.some((r) => rowToObject(r.header, r.values).discord_id === discordId);
}
