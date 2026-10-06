import { getRows } from "./sheets.js";
import { currentPeriodStart } from "./config.js";

export function datesInRange(scope) {
  const today = new Date();
  const days = scope === "week" ? 7 : 1;
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Returns an array of "**Name** — attendance x/y · standups n · DMs n ·
// follow-ups n [· ⚠️ strikes n]" lines for every active rep, over the given
// scope ("today" | "week"). Strike counts are for the CURRENT 2-month
// period (see currentPeriodStart), not the report's own date range — that
// matches what actually counts toward the termination threshold.
export async function buildReportLines(env, scope) {
  const dates = datesInRange(scope);

  const [repsData, attendanceData, logsData, strikesData] = await Promise.all([
    getRows(env, "Reps"),
    getRows(env, "Attendance"),
    getRows(env, "DailyLogs"),
    getRows(env, "Strikes"),
  ]);

  const repIdx = repsData.header.indexOf("discord_id");
  const nameIdx = repsData.header.indexOf("name");
  const statusIdx = repsData.header.indexOf("status");
  const activeReps = repsData.rows.filter((r) => r[statusIdx] === "active");

  const attDateIdx = attendanceData.header.indexOf("date");
  const attRepIdx = attendanceData.header.indexOf("discord_id");
  const attStatusIdx = attendanceData.header.indexOf("status");

  const logTimeIdx = logsData.header.indexOf("timestamp");
  const logRepIdx = logsData.header.indexOf("discord_id");
  const logTypeIdx = logsData.header.indexOf("type");

  const strikeRepIdx = strikesData.header.indexOf("discord_id");
  const strikeDateIdx = strikesData.header.indexOf("date");
  const periodStart = currentPeriodStart();

  return activeReps.map((rep) => {
    const repId = rep[repIdx];
    const present = attendanceData.rows.filter(
      (r) => dates.includes(r[attDateIdx]) && r[attRepIdx] === repId && r[attStatusIdx] !== "absent"
    ).length;
    const standups = logsData.rows.filter(
      (r) => r[logRepIdx] === repId && r[logTypeIdx] === "standup" && dates.includes((r[logTimeIdx] || "").slice(0, 10))
    ).length;
    const dms = logsData.rows.filter(
      (r) => r[logRepIdx] === repId && r[logTypeIdx] === "dm" && dates.includes((r[logTimeIdx] || "").slice(0, 10))
    ).length;
    const followups = logsData.rows.filter(
      (r) => r[logRepIdx] === repId && r[logTypeIdx] === "followup" && dates.includes((r[logTimeIdx] || "").slice(0, 10))
    ).length;
    const strikeCount = strikesData.rows.filter(
      (r) => r[strikeRepIdx] === repId && r[strikeDateIdx] >= periodStart
    ).length;
    const strikeText = strikeCount > 0 ? ` · ⚠️ strikes ${strikeCount}` : "";
    return `**${rep[nameIdx]}** — attendance ${present}/${dates.length} · standups ${standups} · DMs ${dms} · follow-ups ${followups}${strikeText}`;
  });
}
