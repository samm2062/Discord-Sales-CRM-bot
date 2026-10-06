import { appendRow, getRows } from "./sheets.js";
import { sendChannelMessage } from "./discordApi.js";
import { notifyDesk } from "./reps.js";
import { todayISO, currentPeriodStart } from "./config.js";

const ABSENCES_PER_STRIKE = 3;
const QUOTA_MISSES_PER_STRIKE = 4;

// reason: "no-show" (every ABSENCES_PER_STRIKE unexcused absences) or
// "under-quota" (every QUOTA_MISSES_PER_STRIKE under-quota days).
async function issueStrike(env, discordId, name, reason, details) {
  await appendRow(env, "Strikes", [todayISO(), discordId, reason, details, name]);
}

// Strike count for THIS period only (see currentPeriodStart) — strikes from
// prior periods still exist in the sheet for audit history, they just don't
// count toward the threshold anymore.
export async function countStrikes(env, discordId) {
  const periodStart = currentPeriodStart();
  const { header, rows } = await getRows(env, "Strikes");
  const dateIdx = header.indexOf("date");
  const idx = header.indexOf("discord_id");
  return rows.filter((r) => r[idx] === discordId && r[dateIdx] >= periodStart).length;
}

async function countAbsencesThisPeriod(env, discordId) {
  const periodStart = currentPeriodStart();
  const { header, rows } = await getRows(env, "Attendance");
  const dateIdx = header.indexOf("date");
  const repIdx = header.indexOf("discord_id");
  const statusIdx = header.indexOf("status");
  return rows.filter(
    (r) => r[repIdx] === discordId && r[statusIdx] === "absent" && r[dateIdx] >= periodStart
  ).length;
}

async function countQuotaMissesThisPeriod(env, discordId) {
  const periodStart = currentPeriodStart();
  const { header, rows } = await getRows(env, "QuotaMisses");
  const dateIdx = header.indexOf("date");
  const repIdx = header.indexOf("discord_id");
  return rows.filter((r) => r[repIdx] === discordId && r[dateIdx] >= periodStart).length;
}

async function notifyStrikeWarning(env, discordId) {
  const threshold = parseInt(env.STRIKE_THRESHOLD, 10) || 3;
  const total = await countStrikes(env, discordId);
  await notifyDesk(env, discordId, {
    content: `🚨 You've received a strike — **${total} of ${threshold} this period**. Reaching ${threshold} is grounds for termination. Strikes reset automatically every 2 months.`,
  });
}

// Posts to #admin-dashboard once this rep's strikes THIS PERIOD reach the
// threshold. This ONLY posts a notification — it never removes anyone from
// the server or takes any action on its own. That decision is yours.
export async function checkAndNotifyIfStruckOut(env, discordId, repName) {
  const threshold = parseInt(env.STRIKE_THRESHOLD, 10) || 3;
  const total = await countStrikes(env, discordId);
  if (total >= threshold) {
    await sendChannelMessage(env, env.ADMIN_DASHBOARD_CHANNEL_ID, {
      content: `🚨 **${repName}** (<@${discordId}>) has reached **${total} strikes this period** (threshold: ${threshold}) — per policy this is grounds for termination. Run \`/report scope:week\` for their recent activity. No automatic action has been taken; this is a decision for you to make. (Strikes reset every 2 months.)`,
    });
  }
}

// Called after an unexcused absence has already been logged to Attendance.
// Every ABSENCES_PER_STRIKE unexcused absences within the current period
// converts into one strike. Returns { struck, count } — count is this
// period's running absence tally, useful for the routine desk message.
export async function recordAbsenceAndMaybeStrike(env, discordId, repName) {
  const count = await countAbsencesThisPeriod(env, discordId);
  if (count > 0 && count % ABSENCES_PER_STRIKE === 0) {
    await issueStrike(
      env,
      discordId,
      repName,
      "no-show",
      `${count} unexcused absences this period (${ABSENCES_PER_STRIKE} = 1 strike).`
    );
    await notifyStrikeWarning(env, discordId);
    await checkAndNotifyIfStruckOut(env, discordId, repName);
    return { struck: true, count };
  }
  return { struck: false, count };
}

// Logs today as an under-quota day and, every QUOTA_MISSES_PER_STRIKE such
// days within the current period, converts into one strike. Returns
// { struck, count }.
export async function recordQuotaMissAndMaybeStrike(env, discordId, repName) {
  await appendRow(env, "QuotaMisses", [todayISO(), discordId, repName]);
  const count = await countQuotaMissesThisPeriod(env, discordId);
  if (count > 0 && count % QUOTA_MISSES_PER_STRIKE === 0) {
    await issueStrike(
      env,
      discordId,
      repName,
      "under-quota",
      `${count} under-quota days this period (${QUOTA_MISSES_PER_STRIKE} = 1 strike).`
    );
    await notifyStrikeWarning(env, discordId);
    await checkAndNotifyIfStruckOut(env, discordId, repName);
    return { struck: true, count };
  }
  return { struck: false, count };
}
