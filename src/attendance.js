import { findRows, appendRow, updateRow, rowToObject } from "./sheets.js";
import { todayISO } from "./config.js";

// Shared by /checkin and /standup (standup implies check-in). If today's row
// doesn't exist yet, creates it as "present". If it exists as "excused" or
// "absent" (e.g. they said they'd be out, then showed up after all — or
// they were marked absent and are late), upgrades it to "present" rather
// than leaving it as-is. Returns "already" (already present), "present"
// (newly present), or "upgraded" (was excused/absent, now present).
// `name` is written alongside discord_id purely for human readability when
// browsing the sheet — discord_id stays the actual key everything else
// matches against.
export async function markAttendance(env, discordId, name) {
  const today = todayISO();
  const existing = await findRows(env, "Attendance", "date", today);
  const mine = existing.find((r) => rowToObject(r.header, r.values).discord_id === discordId);

  const now = new Date().toISOString();

  if (!mine) {
    await appendRow(env, "Attendance", [today, discordId, "present", now, name]);
    return "present";
  }

  const obj = rowToObject(mine.header, mine.values);
  if (obj.status === "present") return "already";

  await updateRow(env, "Attendance", mine._row, [today, discordId, "present", now, name]);
  return "upgraded";
}
