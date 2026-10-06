import { appendRow } from "../sheets.js";
import { createProspect, findProspect } from "../prospects.js";
import { notifyDesk } from "../reps.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name)?.value ?? "";
}

export default async function newprospect(env, interaction) {
  const user = interaction.member.user;
  const name = user.global_name || user.username;
  const prospect = getOption(interaction, "prospect");
  const brand = getOption(interaction, "brand");
  const platform = getOption(interaction, "platform");
  const notes = getOption(interaction, "notes");

  const existing = await findProspect(env, prospect);
  if (existing && existing.obj.status === "Closed Won") {
    return {
      flags: 64,
      content: `🚫 **${existing.obj.prospect}** has already been closed as a deal by ${existing.obj.owner_name || "another rep"} — you can't DM them. No re-contacting a landed client.`,
    };
  }

  const created = await createProspect(env, {
    prospect,
    brand,
    platform,
    ownerDiscordId: user.id,
    ownerName: name,
    notes,
  });

  await appendRow(env, "DailyLogs", [
    new Date().toISOString(),
    user.id,
    "dm",
    platform,
    notes,
    "",
    prospect,
    name,
  ]);

  const embed = {
    title: `New prospect — ${prospect}`,
    color: 0x5865f2,
    fields: [
      { name: "Brand", value: brand, inline: true },
      { name: "Platform", value: platform, inline: true },
      { name: "Follow-up 1 due", value: created.followup1_date, inline: true },
    ],
    description: notes,
    timestamp: new Date().toISOString(),
  };

  await notifyDesk(env, user.id, { embeds: [embed] });

  return {
    flags: 64,
    content: `Logged **${prospect}** — check your desk channel for the full card.`,
  };
}
