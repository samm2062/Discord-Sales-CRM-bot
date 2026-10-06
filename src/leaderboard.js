import { getRows } from "./sheets.js";

// Points formula — four independent categories, all stack:
//   DMs (self-reported, via /standup's "dms_yesterday")  = 1 point each
//   new prospect logged (/newprospect, type "dm")        = 3 points
//   follow-up logged (/followup, type "followup")        = 2 points
//   ...and if that follow-up's outcome was "Closed Won"  = +10 bonus on top of the 2

// Dates from this Sunday through today (inclusive), calendar-aligned — not
// a rolling 7 days. This is what makes the leaderboard genuinely reset each
// Sunday rather than sliding. The work week is Sunday-Friday (Saturday is
// the holiday), so a Sunday anchor lines up with the actual work week.
export function currentWeekDates() {
  return weekDatesContaining(new Date());
}

function weekDatesContaining(anchorDate, forceFullWeek) {
  const dayOfWeek = anchorDate.getUTCDay(); // 0=Sun .. 6=Sat — already week-start-aligned
  const sunday = new Date(anchorDate);
  sunday.setUTCDate(anchorDate.getUTCDate() - dayOfWeek);
  const count = forceFullWeek || dayOfWeek + 1; // through today if not forced
  const dates = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Returns rows sorted by points descending: { repId, name, points, dms,
// newProspects, followups, replies, deals }. Only includes active reps.
export async function computeLeaderboard(env, dates) {
  const [repsData, logsData] = await Promise.all([
    getRows(env, "Reps"),
    getRows(env, "DailyLogs"),
  ]);

  const statusIdx = repsData.header.indexOf("status");
  const repIdIdx = repsData.header.indexOf("discord_id");
  const nameIdx = repsData.header.indexOf("name");
  const activeReps = repsData.rows.filter((r) => r[statusIdx] === "active");

  const logTimeIdx = logsData.header.indexOf("timestamp");
  const logRepIdx = logsData.header.indexOf("discord_id");
  const logTypeIdx = logsData.header.indexOf("type");
  const logField1Idx = logsData.header.indexOf("field1"); // outcome, for type "followup"
  const logDmCountIdx = logsData.header.indexOf("dm_count"); // self-reported, for type "standup"

  const dateSet = new Set(dates);

  const results = activeReps.map((rep) => {
    const repId = rep[repIdIdx];
    const myLogs = logsData.rows.filter(
      (r) => r[logRepIdx] === repId && dateSet.has((r[logTimeIdx] || "").slice(0, 10))
    );

    let points = 0;
    let dms = 0;
    let newProspects = 0;
    let followups = 0;
    let replies = 0;
    let deals = 0;

    for (const r of myLogs) {
      const type = r[logTypeIdx];
      if (type === "standup") {
        const reported = parseInt(r[logDmCountIdx], 10) || 0;
        dms += reported;
        points += reported;
      } else if (type === "dm") {
        newProspects++;
        points += 3;
      } else if (type === "followup") {
        followups++;
        const outcome = r[logField1Idx];
        if (outcome === "Replied") replies++;
        if (outcome === "Closed Won") {
          deals++;
          points += 12; // 2 base + 10 deal bonus
        } else {
          points += 2;
        }
      }
    }

    return { repId, name: rep[nameIdx], points, dms, newProspects, followups, replies, deals };
  });

  return results.sort((a, b) => b.points - a.points);
}

// Formats a monospace-aligned table for a Discord code block.
export function formatLeaderboardTable(rows) {
  if (rows.length === 0) return "No activity logged yet.";

  const rankWidth = 4;
  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length)) + 1;

  const header =
    "#".padEnd(rankWidth) +
    "Name".padEnd(nameWidth) +
    "Pts".padStart(5) +
    "DMs".padStart(6) +
    "Reply".padStart(7) +
    "FUs".padStart(5) +
    "Deals".padStart(7);

  const lines = rows.map((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return (
      medal.padEnd(rankWidth) +
      r.name.padEnd(nameWidth) +
      String(r.points).padStart(5) +
      String(r.dms).padStart(6) +
      String(r.newProspects).padStart(7) +
      String(r.followups).padStart(5) +
      String(r.deals).padStart(7)
    );
  });

  return "```\n" + header + "\n" + lines.join("\n") + "\n```";
}
