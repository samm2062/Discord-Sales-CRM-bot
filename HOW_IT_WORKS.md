# How it works

A walkthrough of the design, the logic, and the problems solved while building
this. Written so someone can explain the project end to end.

## 1. The big picture

The bot is a single Cloudflare Worker with two entry points:

- **`fetch`** is called when Discord sends an interaction (a slash command or a button click).
- **`scheduled`** is called by Cloudflare Cron Triggers for the periodic jobs.

Both read and write a Google Sheet through the Sheets REST API, and both talk
back to Discord through its REST API. There is no database server, no queue, and
no long-running process.

### Why serverless HTTP instead of a normal bot?

Most Discord bots use the **Gateway**: a persistent WebSocket that streams every
event to the bot. That needs a process running 24/7. Most free hosts put idle
processes to sleep, and a sleeping bot silently misses reminders and attendance
checks, which are the point of this system.

Discord also supports **HTTP Interactions**: Discord calls your URL when a user
runs a command. A Worker only runs when called, so it is free at this scale and
cannot "go offline".

**The trade-off:** an HTTP-only bot cannot see plain chat messages or emoji
reactions, because those events only exist on the Gateway. Features had to be
designed around that. For example, one-tap follow-up logging uses **buttons**
(delivered as interactions) instead of emoji reactions.

## 2. Lifecycle of a slash command

Using `/newprospect` as the example:

1. **Receive.** Discord POSTs JSON to the Worker with `X-Signature-Ed25519` and `X-Signature-Timestamp` headers.
2. **Verify.** The Worker checks the signature against the app's public key (`discord-interactions`). Invalid requests get a 401. Without this, anyone who found the URL could fake commands.
3. **Route.** The command name maps to a handler in `src/commands/`.
4. **Acknowledge fast.** Discord requires a response within **3 seconds**, but Sheets calls can be slower. The Worker immediately returns a *deferred* response (type 5). Whether the reply is private ("ephemeral") has to be decided here, because Discord does not allow changing it on the later edit.
5. **Work in the background.** Using `ctx.waitUntil`, the handler validates input, reads and writes Sheets, and posts to the rep's private channel.
6. **Finish.** The Worker edits the original deferred message with the result, or with a friendly error if something threw.

Button clicks follow the same pattern with a different interaction type: the
click arrives as a *message component* interaction, the Worker defers an
*update*, does the work, then edits the original message to a confirmation and
removes the buttons so they can't be clicked twice.

## 3. Scheduled jobs

| Job | When (Sun to Fri unless noted) | What it does |
|---|---|---|
| Morning prompt | start of day | Pings the rep role with a check-in reminder and a rotating quote |
| Attendance sweep | midday cutoff | Marks anyone with no check-in or excuse as absent, tallies toward a strike, notifies them |
| Follow-up sweep | same trigger | DMs each rep (in their private channel) about due and overdue follow-ups, with buttons |
| Quota sweep | end of day | For reps who were present: counts DMs, tallies a miss if under quota and not excused |
| Leaderboard post | evening | Posts the week's standings |
| Weekly rollup + winner | Saturday | Posts the admin summary and announces the week's top scorer |

**Things worth knowing**
- Cron expressions run in **UTC**, so local times are converted (the sample config targets UTC+5:45).
- The free plan caps an account at **5 cron triggers**, so related jobs share a trigger and the code dispatches on the cron string.
- Cloudflare's cron parser numbers weekdays **1 to 7 (Sunday = 7)**, not the 0 to 6 convention. A Sunday-to-Friday week is `1-5,7`.

## 4. Data model (Google Sheets as the database)

Each tab is a table (see `SHEET_SCHEMA.md`): `Reps`, `Prospects`, `DailyLogs`,
`Attendance`, `Excuses`, `QuotaMisses`, `Strikes`, `Handovers`.

- **Append-only logs** (`DailyLogs`, `Attendance`, `Strikes`, ...) give an audit trail for free.
- **Reads are header-based**, so the code finds columns by name rather than position.
- **Auth.** The Node `googleapis` library doesn't run on Workers, so `sheets.js` builds a **service-account JWT**, signs it with the Web Crypto API (RS256), exchanges it for an access token, and caches the token for the isolate's lifetime.
- **Writes use `valueInputOption=RAW`.** See the bug list below for why.

## 5. The core logic

**Attendance.** Each work day a rep is `present` (checked in), `excused`
(used `/excuse`), or `absent` (neither by the cutoff). A late `/checkin` upgrades an
excused or absent row to present.

**Strikes.** An excuse protects that whole day. Otherwise:
- every **3 unexcused absences** in a period = **1 strike**
- every **4 under-quota days** = **1 strike**
- Periods are **2-month calendar blocks** computed from the date (no stored state). Old strikes remain in the sheet but stop counting, so "reset" needs no cleanup job.
- Reaching the threshold posts a notice to admins. A human makes any decision.

**Follow-up cadence.** `/newprospect` precomputes three follow-up dates a fixed
interval apart. The sweep finds the first *not-done* slot whose date has arrived and
nudges the owner daily until it is logged. `/followup` and the buttons both mark the
next undone slot, so a late follow-up still counts.

**Points.** Four independent categories that add up:
- self-reported DMs from `/standup` (1 point each)
- a new prospect logged (3)
- a follow-up logged (2)
- a deal closed as *Closed Won* (+10 on top of the follow-up's 2)

They are computed live from `DailyLogs`, and the week is calendar-aligned so it
resets on a fixed day. The strike/quota system deliberately **does not** use the
self-reported DM number, only real command usage, so accountability can't be
gamed by typing a figure.

**Private desk channels.** `/verify` creates a channel visible only to that rep and
admins (explicit permission overwrites, including an explicit grant for the bot) and
stores its ID in `Reps`. Helpers like `notifyDesk` look it up so personal nudges
and activity mirrors go to the right place.

## 6. Problems solved (good interview material)

| Problem | Cause | Fix |
|---|---|---|
| Leaderboard and "my prospects" showed nothing for a user whose rows existed | Discord IDs are 18-digit numbers. Sheets' default `USER_ENTERED` mode parsed them as numbers and lost precision, so string comparisons failed | Write with `RAW` so values stay strings |
| Private replies weren't private | Ephemeral-ness is fixed by the *initial* deferred ack, not the later edit | Decide privacy per command before deferring |
| Intermittent wrong values when updating rows | Sheets omits trailing empty cells when reading, so index-based writes misaligned | Pad each row to header length before editing |
| Cron deploy rejected | Free plan allows 5 triggers; then `0-5` for weekdays was invalid | Merge jobs onto shared triggers; use Cloudflare's 1-7 weekday numbering |
| "Missing Access" posting to private channels | `@everyone` is denied in those channels and the bot isn't exempt | Explicit bot overwrite on creation; Administrator on the bot role for robustness |
| Wanted emoji-reaction logging | Reactions only exist on the Gateway | Message-component buttons, which arrive as interactions |
| Silent zeros after adding a column | The code looked up a header that didn't exist yet, so the index was -1 | Add the header; lesson: validate expected headers at startup (a worthwhile next step) |
| Double-clicking a reminder button | Component stays active after use | Edit the message on completion and remove the buttons |

## 7. Trade-offs and what I'd do next

- **Sheets as a database** is great for transparency and zero cost, but it is not transactional and rate-limited. For more users: Cloudflare D1/KV for the hot path, Sheets as an export.
- **Tests.** The logic (points, strike conversion, week and period math) is pure functions over arrays and is the obvious thing to cover first. I verified date math with ad-hoc scripts.
- **Schema validation on boot** to fail loudly if a tab or header is missing.
- **Idempotency.** If a cron job ever double-fires, some writes could duplicate; adding de-duplication keys would harden this.
- **Config.** Timezone, work week and thresholds are partly hardcoded; making them fully declarative is a clean next step.

## 8. Quick answers

**Why not discord.js?** It needs the Gateway, so an always-on host. This design trades
chat-message visibility for zero hosting cost and zero downtime.

**How do you stop forged requests?** Every interaction is Ed25519-verified against the app's public key before any logic runs.

**Why Sheets?** Managers can read, audit and fix data directly; at this scale it's fast enough, and it's free.

**How is "reset every 2 months" done without a job?** Counts are filtered by the current period's start date, derived from today. Nothing is deleted.

**What would break first at scale?** Sheets read latency and quota. Every sweep reads whole tabs; the fix is a real database for hot paths.

**What was the hardest bug?** The Discord-ID precision issue: nothing errored, rows existed, and lookups just silently returned nothing, until I compared the stored cell value to the real ID.
