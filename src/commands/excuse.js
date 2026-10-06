import { submitExcuse } from "../excuses.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name)?.value ?? "";
}

export default async function excuse(env, interaction) {
  const user = interaction.member.user;
  const reason = getOption(interaction, "reason");

  await submitExcuse(env, user.id, user.global_name || user.username, reason);

  await notifyDesk(env, user.id, {
    content: `📝 Excuse logged for today: "${reason}" — you're covered, no strike for today.`,
  });

  return {
    flags: 64,
    content: `Got it — logged your excuse for today: "${reason}". You won't get a strike for today's attendance or DM quota.`,
  };
}
