import { appendRow } from "../sheets.js";
import { reassignProspect } from "../prospects.js";
import { isAdmin } from "../config.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name);
}

export default async function handover(env, interaction) {
  if (!isAdmin(env, interaction)) {
    return { flags: 64, content: "Only admins can run `/handover`." };
  }

  const from = getOption(interaction, "from").value; // resolved user id
  const to = getOption(interaction, "to").value;
  const prospectQuery = getOption(interaction, "prospect").value;
  const reason = getOption(interaction, "reason").value;
  const admin = interaction.member.user;

  const toUser = interaction.data.resolved?.users?.[to];
  const toName = toUser?.global_name || toUser?.username || to;

  const updated = await reassignProspect(env, prospectQuery, to, toName);
  if (!updated) {
    return { flags: 64, content: `No prospect found matching "${prospectQuery}".` };
  }

  await appendRow(env, "Handovers", [
    new Date().toISOString(),
    updated.prospect_id,
    from,
    to,
    reason,
    admin.id,
  ]);

  await notifyDesk(env, from, {
    content: `🔁 **${updated.prospect}** has been moved off your list, to <@${to}>. Reason: ${reason}`,
  });
  await notifyDesk(env, to, {
    content: `🔁 **${updated.prospect}** has been handed over to you, from <@${from}>. Reason: ${reason}. Run \`/myprospects\` to see it.`,
  });

  return {
    flags: 64,
    content: `Done — **${updated.prospect}** is now owned by <@${to}>.`,
  };
}
