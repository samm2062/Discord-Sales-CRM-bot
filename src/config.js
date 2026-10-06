export function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function isAdmin(env, interaction) {
  const roles = interaction.member?.roles || [];
  return roles.includes(env.ADMIN_ROLE_ID);
}

export function daysBetween(isoDateA, isoDateB) {
  const a = new Date(isoDateA);
  const b = new Date(isoDateB);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// Strikes reset every 2 months, aligned to calendar bimesters (Jan-Feb,
// Mar-Apr, May-Jun, Jul-Aug, Sep-Oct, Nov-Dec) rather than a rolling window
// — this needs no stored state, it's just "what period does today fall in."
// Returns the period's start date as YYYY-MM-DD.
export function currentPeriodStart() {
  return batchStart(todayISO());
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Same 2-month calendar bimester logic as currentPeriodStart, but for any
// date — used to group reps into hiring "batches" by their start_date.
export function batchStart(isoDate) {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11
  const periodStartMonth = month - (month % 2);
  const mm = String(periodStartMonth + 1).padStart(2, "0");
  return `${year}-${mm}-01`;
}

// Human-readable label for the batch a date falls into, e.g. "September–October 2026".
export function batchLabel(isoDate) {
  const d = new Date(isoDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const periodStartMonth = month - (month % 2);
  return `${MONTH_NAMES[periodStartMonth]}–${MONTH_NAMES[periodStartMonth + 1]} ${year}`;
}
