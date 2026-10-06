import { isAdmin, todayISO } from "../config.js";
import { buildReportLines } from "../reportBuilder.js";

function getOption(interaction, name) {
  return interaction.data.options.find((o) => o.name === name)?.value;
}

export default async function report(env, interaction) {
  if (!isAdmin(env, interaction)) {
    return { flags: 64, content: "Only admins can run `/report`." };
  }

  const scope = getOption(interaction, "scope");
  const lines = await buildReportLines(env, scope);

  return {
    flags: 64,
    embeds: [
      {
        title: `Report — ${scope === "week" ? "This week" : "Today"} (${todayISO()})`,
        description: lines.join("\n") || "No active reps found.",
        color: 0x5865f2,
      },
    ],
  };
}
