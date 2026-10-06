import { getRows, updateRow, appendRow, rowToObject } from "./sheets.js";
import { todayISO } from "./config.js";

const HEADER = [
  "prospect_id",
  "prospect",
  "brand",
  "platform",
  "owner_discord_id",
  "status",
  "notes",
  "first_contact_date",
  "followup1_date",
  "followup1_done",
  "followup2_date",
  "followup2_done",
  "followup3_date",
  "followup3_done",
  "response",
  "deal_stage",
  "revenue",
  "owner_name",
];

function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Matches by prospect_id first, then case-insensitive prospect handle/name.
export async function findProspect(env, query) {
  const { header, rows } = await getRows(env, "Prospects");
  const idIdx = header.indexOf("prospect_id");
  const nameIdx = header.indexOf("prospect");

  let match = rows.find((r) => r[idIdx] === query);
  if (!match) {
    const q = query.toLowerCase();
    match = rows.find((r) => (r[nameIdx] || "").toLowerCase() === q);
  }
  if (!match) return null;

  const rowNumber = rows.indexOf(match) + 2; // +1 for 0-index, +1 for header row
  // The Sheets API omits trailing empty cells from a row, so pad back out to
  // the full header length before doing index-based writes on this array.
  const values = [...match];
  while (values.length < header.length) values.push("");
  return { rowNumber, header, values, obj: rowToObject(header, values) };
}

// Creates a new prospect with all three follow-up dates precomputed on a
// fixed cadence (FOLLOWUP_INTERVAL_DAYS apart), starting from today.
export async function createProspect(env, { prospect, brand, platform, ownerDiscordId, ownerName, notes }) {
  const intervalDays = parseInt(env.FOLLOWUP_INTERVAL_DAYS, 10) || 3;
  const today = todayISO();
  const fu1 = addDays(today, intervalDays);
  const fu2 = addDays(fu1, intervalDays);
  const fu3 = addDays(fu2, intervalDays);

  const row = [
    prospect,
    prospect,
    brand,
    platform,
    ownerDiscordId,
    "Contacted",
    notes,
    today,
    fu1,
    "false",
    fu2,
    "false",
    fu3,
    "false",
    "",
    "",
    "0",
    ownerName,
  ];
  await appendRow(env, "Prospects", row);
  return rowToObject(HEADER, row);
}

// Marks the next not-yet-done follow-up slot (1, 2, or 3) as done, and
// updates notes/response/deal_stage/revenue. Returns { obj, completedSlot }
// (completedSlot is null if all three were already done), or null if no
// matching prospect was found.
export async function logFollowup(env, query, { outcome, notes, dealStage, revenue }) {
  const prospect = await findProspect(env, query);
  if (!prospect) return null;

  const values = [...prospect.values];
  const idx = (name) => HEADER.indexOf(name);

  let completedSlot = null;
  for (const slot of [1, 2, 3]) {
    if (values[idx(`followup${slot}_done`)] !== "true") {
      values[idx(`followup${slot}_done`)] = "true";
      completedSlot = slot;
      break;
    }
  }

  values[idx("notes")] = notes;
  values[idx("response")] = outcome;
  if (dealStage) {
    values[idx("deal_stage")] = dealStage;
    if (dealStage === "Closed Won" || dealStage === "Closed Lost") {
      values[idx("status")] = dealStage;
    }
  }
  if (revenue != null) values[idx("revenue")] = String(revenue);

  await updateRow(env, "Prospects", prospect.rowNumber, values);
  return { obj: rowToObject(HEADER, values), completedSlot };
}

// Reassigns every OPEN prospect (not Closed Won/Lost) owned by fromDiscordId
// over to toDiscordId. Closed prospects are left alone — they're historical
// records of who actually closed them, not active work to hand off. Returns
// the list of { prospect_id, name } moved.
export async function reassignAllProspects(env, fromDiscordId, toDiscordId, toName) {
  const { header, rows } = await getRows(env, "Prospects");
  const idIdx = header.indexOf("prospect_id");
  const nameIdx = header.indexOf("prospect");
  const ownerIdx = header.indexOf("owner_discord_id");
  const ownerNameIdx = header.indexOf("owner_name");
  const statusIdx = header.indexOf("status");

  const moved = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[ownerIdx] !== fromDiscordId) continue;
    if (row[statusIdx] === "Closed Won" || row[statusIdx] === "Closed Lost") continue;

    const values = [...row];
    while (values.length < header.length) values.push("");
    values[ownerIdx] = toDiscordId;
    values[ownerNameIdx] = toName;

    await updateRow(env, "Prospects", i + 2, values);
    moved.push({ prospect_id: values[idIdx], name: values[nameIdx] });
  }
  return moved;
}

export async function reassignProspect(env, query, newOwnerDiscordId, newOwnerName) {
  const prospect = await findProspect(env, query);
  if (!prospect) return null;
  const values = [...prospect.values];
  values[HEADER.indexOf("owner_discord_id")] = newOwnerDiscordId;
  values[HEADER.indexOf("owner_name")] = newOwnerName;
  await updateRow(env, "Prospects", prospect.rowNumber, values);
  return rowToObject(HEADER, values);
}

export { HEADER as PROSPECTS_HEADER };
