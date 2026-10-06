import { appendRow } from "../sheets.js";
import { logFollowup } from "../prospects.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name)?.value;
}

export default async function followup(env, interaction) {
  const user = interaction.member.user;
  const prospectQuery = getOption(interaction, "prospect");
  const outcome = getOption(interaction, "outcome");
  const notes = getOption(interaction, "notes");
  const dealStage = getOption(interaction, "deal_stage");
  const revenueRaw = getOption(interaction, "revenue");
  const revenue = revenueRaw != null ? Number(revenueRaw) : null;

  const result = await logFollowup(env, prospectQuery, { outcome, notes, dealStage, revenue });
  if (!result) {
    return { flags: 64, content: `No prospect found matching "${prospectQuery}".` };
  }

  await appendRow(env, "DailyLogs", [
    new Date().toISOString(),
    user.id,
    "followup",
    outcome,
    notes,
    "",
    prospectQuery,
    user.global_name || user.username,
  ]);

  const { obj, completedSlot } = result;
  const embed = {
    title: `Follow-up logged — ${obj.prospect}`,
    color: 0x57f287,
    description: notes,
    fields: [
      { name: "Outcome", value: outcome, inline: true },
      {
        name: "Progress",
        value: completedSlot ? `Follow-up ${completedSlot} of 3 marked done` : "All 3 follow-ups already done",
        inline: true,
      },
      ...(dealStage ? [{ name: "Deal stage", value: dealStage, inline: true }] : []),
    ],
    timestamp: new Date().toISOString(),
  };

  await notifyDesk(env, user.id, { embeds: [embed] });

  return {
    flags: 64,
    content: `Logged follow-up for **${obj.prospect}** — check your desk channel for the full card.`,
  };
}
