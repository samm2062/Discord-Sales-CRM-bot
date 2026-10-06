import { appendRow } from "../sheets.js";

function getOption(interaction, name) {
  return interaction.data.options?.find((o) => o.name === name)?.value ?? "";
}

export default async function win(env, interaction) {
  const user = interaction.member.user;
  const title = getOption(interaction, "title");
  const details = getOption(interaction, "details");

  await appendRow(env, "DailyLogs", [
    new Date().toISOString(),
    user.id,
    "win",
    title,
    details,
    "",
    "",
    user.global_name || user.username,
  ]);

  return {
    embeds: [
      {
        title: `🎉 ${title}`,
        description: details || undefined,
        color: 0xfee75c,
        author: { name: user.global_name || user.username },
        timestamp: new Date().toISOString(),
      },
    ],
    react: "🎉", // index.js adds this reaction after posting, to seed engagement
  };
}
