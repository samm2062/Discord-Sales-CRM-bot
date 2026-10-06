# Google Sheet schema

One Google Sheet. Tab names and header rows must match exactly (case-sensitive)
— the bot reads columns by header name, not position.

Every tab below that references a rep also gets a `name` (or `owner_name`)
column, written by the bot itself alongside the `discord_id` — this is
purely for readability when you're looking at the sheet; `discord_id` stays
the real key everything is matched against internally, since a name can
change but an ID never does.

Two features don't need any new tabs at all — they're computed live from
tabs that already exist:
- **The weekly leaderboard** (`#leaderboard`) is computed entirely from
  `DailyLogs`: `standup` rows contribute their self-reported `dm_count` as
  points 1:1, `type = "dm"` rows (from `/newprospect`) are worth 3 points,
  `type = "followup"` rows are worth 2 (12 if `field1` = "Closed Won" — the
  2 base points plus a 10-point deal bonus). See `src/leaderboard.js`.
- **Hiring batches** (`/batches`, admin-only) are computed from `Reps`'
  `start_date` column, grouped into the same 2-month calendar periods
  strikes use (see `src/config.js`'s `batchStart`/`batchLabel`).

## Tab: `Reps`
| discord_id | name | role | status | start_date | desk_channel_id |
|---|---|---|---|---|---|

- `status`: `active` / `leave` / `offboarded`
- Filled in automatically when someone runs `/verify`.

## Tab: `Prospects`
| prospect_id | prospect | brand | platform | owner_discord_id | status | notes | first_contact_date | followup1_date | followup1_done | followup2_date | followup2_done | followup3_date | followup3_done | response | deal_stage | revenue | owner_name |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|

This is the cold-outreach funnel: a rep DMs a prospect (`/newprospect`), which
sets `first_contact_date` to today and precomputes all three follow-up dates
`FOLLOWUP_INTERVAL_DAYS` apart (default 3 days). Every Sunday-Friday, the bot checks
who has a follow-up due or overdue and nudges that rep directly, in their own
desk channel, until it's logged with `/followup` — which marks the next
follow-up slot done and updates notes/response/deal_stage/revenue.

- `status`: `Contacted` (default) / `Closed Won` / `Closed Lost` — set automatically when `/followup` is given a `deal_stage` of `Closed Won` or `Closed Lost`. Closed prospects stop generating follow-up nudges.
- `followupN_done`: literal text `true` / `false`
- `deal_stage`: free text — use whatever labels make sense to you (e.g. "Negotiating", "Sent Proposal")

## Tab: `DailyLogs`
| timestamp | discord_id | type | field1 | field2 | field3 | linked_prospect_id | name | dm_count |
|---|---|---|---|---|---|---|---|---|

- `type`: `standup` / `dm` / `followup` / `win`
- Field meaning depends on `type`:
  - `standup`: field1=today, field2=blockers, field3=unused, `dm_count`=DMs sent yesterday, self-reported (feeds the leaderboard)
  - `dm`: field1=platform, field2=notes (written by `/newprospect`)
  - `followup`: field1=outcome, field2=notes
  - `win`: field1=title, field2=details
- `dm_count` is only populated on `standup` rows — blank everywhere else.

## Tab: `Attendance`
| date | discord_id | status | checkin_time | name |
|---|---|---|---|---|

- `status`: `present` / `absent` / `excused`
- One row per rep per workday (Sunday–Friday — Saturday is the holiday and isn't tracked). Written by `/checkin` and `/standup` (present), `/excuse` (excused), or the cutoff-sweep cron job (fills in `absent` for anyone with no row at all — meaning they neither checked in nor excused themselves). A late `/checkin` after being marked `absent` or `excused` upgrades the row to `present`.

## Tab: `Excuses`
| date | discord_id | reason | timestamp | name |
|---|---|---|---|---|

- Written by `/excuse`. If a rep has a row here for today, they're protected from both an unexcused absence and an under-quota day for that day — neither counts toward a strike.

## Tab: `QuotaMisses`
| date | discord_id | name |
|---|---|---|

- One row per rep per day they were present but sent fewer than `DAILY_DM_QUOTA` DMs, with no `/excuse` submitted. Every 4th miss (within the current 2-month period) converts into one strike.

## Tab: `Strikes`
| date | discord_id | reason | details | name |
|---|---|---|---|---|

- `reason`: `no-show` (every 3 unexcused absences within the period) or `under-quota` (every 4 under-quota days within the period)
- Written automatically by the cron sweeps — never by a rep directly. Strike counts shown in `/report` and the weekly rollup are for the **current 2-month period only** (calendar-aligned: Jan-Feb, Mar-Apr, etc.) — older strikes stay in this tab forever for audit history, they just stop counting toward the threshold once the period rolls over. When a rep reaches `STRIKE_THRESHOLD` strikes in the current period, the bot posts a notice to `#admin-dashboard` — **it never removes anyone from the server automatically**, that decision is always manual.

## Tab: `Handovers`
| timestamp | prospect_id | from_discord_id | to_discord_id | reason | triggered_by |
|---|---|---|---|---|---|

- Written when an admin runs `/handover` or `/handoverall` to move prospect(s) from one rep to another (e.g. someone leaves the team mid-funnel).
- The bot writes only the six columns above. To see names instead of IDs, optionally add formula columns to the right, e.g. in `G2` for `from_name`:
  `=ARRAYFORMULA(IF(C2:C="","",IFERROR(VLOOKUP(C2:C,Reps!A:B,2,FALSE),"Unknown")))`
  and the same pattern for `to_name` (column D) and `triggered_by` (column F).

## After creating the sheet

1. Note the **Spreadsheet ID** from its URL: `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
2. You'll share this sheet with a Google service account's email (see DEPLOY.md) — that's how the bot gets write access, no OAuth login flow needed.
