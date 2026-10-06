import { currentWeekDates, computeLeaderboard, formatLeaderboardTable } from "../leaderboard.js";

// Public reply on purpose — the whole point of the leaderboard is that
// everyone can see where they stand, so this isn't ephemeral like most
// other commands.
export default async function leaderboard(env, interaction) {
  const dates = currentWeekDates();
  const rows = await computeLeaderboard(env, dates);
  const table = formatLeaderboardTable(rows);

  return {
    content: `📊 **Weekly Leaderboard** — week of ${dates[0]} (resets every Sunday)\n${table}`,
  };
}
