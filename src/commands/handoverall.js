import { appendRow } from "../sheets.js";
import { reassignAllProspects } from "../prospects.js";
import { isAdmin } from "../config.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name);
}

export default async function handoverall(env, interaction) {
  if (!isAdmin(env, interaction)) {
    return { flags: 64, content: "Only admins can run `/handoverall`." };
  }

  const from = getOption(interaction, "from").value;
  const to = getOption(interaction, "to").value;
  const reason = getOption(interaction, "reason").value;
  const admin = interaction.member.user;

  const toUser = interaction.data.resolved?.users?.[to];
  const toName = toUser?.global_name || toUser?.username || to;

  const moved = await reassignAllProspects(env, from, to, toName);
  if (moved.length === 0) {
    return { flags: 64, content: `<@${from}> has no open prospects to hand over.` };
  }

  for (const p of moved) {
    await appendRow(env, "Handovers", [
      new Date().toISOString(),
      p.prospect_id,
      from,
      to,
      reason,
      admin.id,
    ]);
  }

  const names = moved.map((p) => p.name).join(", ");

  await notifyDesk(env, from, {
    content: `🔁 All ${moved.length} of your open prospects have been moved to <@${to}>. Reason: ${reason}`,
  });
  await notifyDesk(env, to, {
    content: `🔁 You've been handed ${moved.length} prospects from <@${from}>. Reason: ${reason}. Run \`/myprospects\` to see them:\n${names}`,
  });

  return {
    flags: 64,
    content: `Done — moved ${moved.length} prospects from <@${from}> to <@${to}>.`,
  };
}
