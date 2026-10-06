import { getRows } from "../sheets.js";
import { isAdmin, batchStart, batchLabel } from "../config.js";

export default async function batches(env, interaction) {
  if (!isAdmin(env, interaction)) {
    return { flags: 64, content: "Only admins can run `/batches`." };
  }

  const { header, rows } = await getRows(env, "Reps");
  const nameIdx = header.indexOf("name");
  const statusIdx = header.indexOf("status");
  const startDateIdx = header.indexOf("start_date");

  if (rows.length === 0) {
    return { flags: 64, content: "No reps on record yet." };
  }

  // Group by batch, keyed by the batch's own start date so we can sort
  // chronologically regardless of label text.
  const groups = new Map();
  for (const r of rows) {
    const startDate = r[startDateIdx];
    if (!startDate) continue;
    const key = batchStart(startDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }

  // Discord embed limits: 25 fields max, 1024 chars per field value. Keep
  // the most recent batches if there are ever more than 25 (unlikely for a
  // long while, but this runs unattended for years).
  const sortedKeys = [...groups.keys()].sort().slice(-25);
  const fields = sortedKeys.map((key) => {
    const members = groups.get(key);
    let value = members
      .sort((a, b) => (a[startDateIdx] || "").localeCompare(b[startDateIdx] || ""))
      .map((r) => {
        const status = r[statusIdx] === "active" ? "active" : r[statusIdx];
        return `${r[nameIdx]} (${status}) — joined ${r[startDateIdx]}`;
      })
      .join("\n");
    if (value.length > 1024) value = value.slice(0, 1000) + "\n… (truncated)";
    return { name: `${batchLabel(key)} — ${members.length} hired`, value };
  });

  return {
    flags: 64,
    embeds: [
      {
        title: "Hiring batches",
        color: 0x5865f2,
        fields,
        footer: { text: "For detailed activity per rep, use /report." },
      },
    ],
  };
}
