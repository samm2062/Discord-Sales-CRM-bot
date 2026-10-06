import { markAttendance } from "../attendance.js";
import { notifyDesk } from "../reps.js";

export default async function checkin(env, interaction) {
  const user = interaction.member.user;
  const discordId = user.id;
  const status = await markAttendance(env, discordId, user.global_name || user.username);

  if (status === "present" || status === "upgraded") {
    await notifyDesk(env, discordId, { content: "✅ Checked in for today." });
  }

  return {
    flags: 64, // ephemeral
    content:
      status === "already"
        ? "You're already checked in for today."
        : "Checked in for today. Don't forget `/standup`.",
  };
}
