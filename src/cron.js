import { getRows, appendRow } from "./sheets.js";
import { sendChannelMessage } from "./discordApi.js";
import { notifyDesk } from "./reps.js";
import { recordAbsenceAndMaybeStrike, recordQuotaMissAndMaybeStrike } from "./strikes.js";
import { hasExcuseToday } from "./excuses.js";
import { todayISO, daysBetween } from "./config.js";
import { buildReportLines } from "./reportBuilder.js";
import { randomQuote } from "./quotes.js";
import { currentWeekDates, computeLeaderboard, formatLeaderboardTable } from "./leaderboard.js";
import { followupButtons } from "./followupButtons.js";

export async function postMorningPrompt(env) {
  const quote = randomQuote();
  await sendChannelMessage(env, env.CHECKIN_CHANNEL_ID, {
    content: `<@&${env.REP_ROLE_ID}>\n☀️ Good morning! "${quote.text}" — ${quote.author}\n\nRun \`/checkin\` and \`/standup\` to kick off the day.`,
    allowed_mentions: { roles: [env.REP_ROLE_ID] },
  });
}

// Runs Sunday-Friday only (Saturday is the holiday, no attendance tracked
// or required that day). Marks anyone active who hasn't checked in (or
// excused themselves) as absent, tallies it toward a no-show strike (3
// unexcused absences = 1 strike), nudges them personally in their desk
// channel, then posts a same-day attendance summary to the admin dashboard.
// Anyone who ran /excuse already has a row for today (status "excused"), so
// they never enter the absentee branch at all — no separate check needed.
export async function sweepAttendance(env) {
  const today = todayISO();
  const [repsData, attendanceData] = await Promise.all([
    getRows(env, "Reps"),
    getRows(env, "Attendance"),
  ]);

  const statusIdx = repsData.header.indexOf("status");
  const repIdIdx = repsData.header.indexOf("discord_id");
  const nameIdx = repsData.header.indexOf("name");
  const deskIdx = repsData.header.indexOf("desk_channel_id");
  const activeReps = repsData.rows.filter((r) => r[statusIdx] === "active");

  const attDateIdx = attendanceData.header.indexOf("date");
  const attRepIdx = attendanceData.header.indexOf("discord_id");
  const checkedInToday = new Set(
    attendanceData.rows.filter((r) => r[attDateIdx] === today).map((r) => r[attRepIdx])
  );

  const absentees = [];
  for (const rep of activeReps) {
    const repId = rep[repIdIdx];
    if (!checkedInToday.has(repId)) {
      await appendRow(env, "Attendance", [today, repId, "absent", "", rep[nameIdx]]);
      absentees.push(rep[nameIdx]);

      const { struck, count } = await recordAbsenceAndMaybeStrike(env, repId, rep[nameIdx]);

      // If it just converted into a strike, notifyStrikeWarning already sent
      // a more serious desk message — skip the routine one to avoid double-posting.
      const deskChannelId = rep[deskIdx];
      if (deskChannelId && !struck) {
        const towardStrike = count % 3 === 0 ? 3 : count % 3;
        await sendChannelMessage(env, deskChannelId, {
          content: `<@${repId}> ⚠️ You haven't checked in today and no \`/excuse\` was submitted — logged as absent (unexcused absence ${towardStrike}/3 this period). Run \`/checkin\` if you're actually here, or use \`/excuse\` next time before this happens.`,
        });
      }
    }
  }

  await sendChannelMessage(env, env.ADMIN_DASHBOARD_CHANNEL_ID, {
    embeds: [
      {
        title: `Attendance — ${today}`,
        color: absentees.length ? 0xed4245 : 0x57f287,
        description:
          absentees.length > 0
            ? `⚠️ Not checked in: ${absentees.join(", ")}`
            : "✅ Everyone checked in on time.",
      },
    ],
  });
}

// Finds the first not-done follow-up slot (1-3) for a prospect row, or null
// if all three are done.
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

// Nudges each rep, in their own desk channel, about every prospect whose
// next follow-up is due today or overdue. Fires Sunday-Friday (not
// Saturday) while the follow-up stays undone — deliberately repeats until
// it's handled, since the whole point is not letting a re-text slip.
export async function followupSweep(env) {
  const today = todayISO();
  const { header, rows } = await getRows(env, "Prospects");
  const statusIdx = header.indexOf("status");
  const idIdx = header.indexOf("prospect_id");
  const nameIdx = header.indexOf("prospect");
  const ownerIdx = header.indexOf("owner_discord_id");
  const brandIdx = header.indexOf("brand");
  const platformIdx = header.indexOf("platform");

  for (const r of rows) {
    if (r[statusIdx] === "Closed Won" || r[statusIdx] === "Closed Lost") continue;

    const next = nextFollowup(header, r);
    if (!next) continue; // all 3 follow-ups already done

    const daysOverdue = daysBetween(next.date, today);
    if (daysOverdue < 0) continue; // not due yet

    const overdueText = daysOverdue === 0 ? "due today" : `overdue by ${daysOverdue}d`;
    await notifyDesk(env, r[ownerIdx], {
      content: `🔔 Follow-up ${next.slot} for **${r[nameIdx]}** (${r[brandIdx]}, ${r[platformIdx]}) is ${overdueText} — tap a button once you've reached out, or use \`/followup\` for deal stage/revenue.`,
      components: followupButtons(r[idIdx]),
    });
  }
}

// Runs Sunday-Friday only. End-of-day check: any rep who was actually
// PRESENT today (not absent, not excused) and didn't send at least
// DAILY_DM_QUOTA DMs (new prospects + follow-ups combined) gets it tallied
// toward an under-quota strike (4 under-quota days = 1 strike), unless they
// submitted /excuse at some point today. Absent/excused reps are skipped
// here entirely — a no-show is tracked separately by sweepAttendance.
export async function dmQuotaSweep(env) {
  const quota = parseInt(env.DAILY_DM_QUOTA, 10) || 50;
  const today = todayISO();
  const [repsData, attendanceData, logsData] = await Promise.all([
    getRows(env, "Reps"),
    getRows(env, "Attendance"),
    getRows(env, "DailyLogs"),
  ]);

  const statusIdx = repsData.header.indexOf("status");
  const repIdIdx = repsData.header.indexOf("discord_id");
  const nameIdx = repsData.header.indexOf("name");
  const deskIdx = repsData.header.indexOf("desk_channel_id");
  const activeReps = repsData.rows.filter((r) => r[statusIdx] === "active");

  const attDateIdx = attendanceData.header.indexOf("date");
  const attRepIdx = attendanceData.header.indexOf("discord_id");
  const attStatusIdx = attendanceData.header.indexOf("status");
  const todaysStatus = new Map(
    attendanceData.rows.filter((r) => r[attDateIdx] === today).map((r) => [r[attRepIdx], r[attStatusIdx]])
  );

  const logTimeIdx = logsData.header.indexOf("timestamp");
  const logRepIdx = logsData.header.indexOf("discord_id");
  const logTypeIdx = logsData.header.indexOf("type");

  for (const rep of activeReps) {
    const repId = rep[repIdIdx];
    if (todaysStatus.get(repId) !== "present") continue;
    if (await hasExcuseToday(env, repId)) continue;

    const dmCount = logsData.rows.filter(
      (r) =>
        r[logRepIdx] === repId &&
        (r[logTypeIdx] === "dm" || r[logTypeIdx] === "followup") &&
        (r[logTimeIdx] || "").slice(0, 10) === today
    ).length;

    if (dmCount < quota) {
      const { struck, count } = await recordQuotaMissAndMaybeStrike(env, repId, rep[nameIdx]);

      const deskChannelId = rep[deskIdx];
      if (deskChannelId && !struck) {
        const towardStrike = count % 4 === 0 ? 4 : count % 4;
        await sendChannelMessage(env, deskChannelId, {
          content: `<@${repId}> ⚠️ You sent ${dmCount}/${quota} DMs today — below quota, no \`/excuse\` was submitted (under-quota day ${towardStrike}/4 this period).`,
        });
      }
    }
  }
}

// Runs Sunday-Friday. Posts the current-week leaderboard to the leaderboard
// channel. Calling this fresh every day (rather than editing one message in
// place) is deliberate — simpler, no message-ID state to track, and it
// doubles as a visible daily "here's where you stand" nudge.
export async function postLeaderboard(env) {
  const dates = currentWeekDates();
  const rows = await computeLeaderboard(env, dates);
  const table = formatLeaderboardTable(rows);
  await sendChannelMessage(env, env.LEADERBOARD_CHANNEL_ID, {
    content: `📊 **Weekly Leaderboard** — week of ${dates[0]} (resets every Sunday)\n${table}`,
  });
}

// Saturday 5 PM: announces this week's (Sun-Fri, plus any optional Saturday
// activity logged before this fires) #1 scorer. The work week is
// Sunday-Friday with Saturday as the holiday, so Saturday afternoon is the
// natural "week's over" moment — reps CAN optionally log /standup (or
// anything else) on Saturday if they choose to work, and it still counts
// here since this fires at 5 PM, not midnight. Purely a shoutout post —
// actually paying out the weekly cash prize is on you. The board keeps
// accumulating until midnight and resets fresh next Sunday.
export async function announceWeeklyWinner(env) {
  const dates = currentWeekDates();
  const rows = await computeLeaderboard(env, dates);
  if (rows.length === 0 || rows[0].points === 0) return;

  const winner = rows[0];
  await sendChannelMessage(env, env.LEADERBOARD_CHANNEL_ID, {
    content: `🏆 **This week's winner: ${winner.name}** with **${winner.points} points** (${winner.dms} DMs, ${winner.newProspects} new prospects, ${winner.followups} follow-ups, ${winner.deals} deals closed)! The weekly incentive goes to them. Board resets fresh Sunday — good luck everyone.`,
  });
}

export async function weeklyRollup(env) {
  const lines = await buildReportLines(env, "week");
  await sendChannelMessage(env, env.ADMIN_DASHBOARD_CHANNEL_ID, {
    embeds: [
      {
        title: `Weekly rollup — week ending ${todayISO()}`,
        description: lines.join("\n") || "No active reps found.",
        color: 0x5865f2,
      },
    ],
  });
}
