# Discord server setup

Create these roles first (Server Settings → Roles):
- `@Admin`: you and any team leads
- `@Rep`: assigned automatically by `/verify`

## Categories and channels

**START HERE**
- `#rules-and-how-it-works`: read-only for everyone. Pin your rules text (a template is below).
- `#introductions`
- `#verify`: post a short message telling new members to run `/verify`.

**DAILY OPS**
- `#check-in`: where `/standup` output lands and where the morning prompt posts. (`/checkin` replies privately and is mirrored into the rep's desk channel.)
- `#wins`: `/win` output.
- `#leaderboard`: bot-only. The current week's standings are posted each evening on work days, plus a "this week's winner" post once a week. Anyone can run `/leaderboard` to check on demand. Every other command is blocked in this channel on purpose, so it stays clean.

**ADMIN DASHBOARD** (visible only to `@Admin`)
- `#admin-dashboard`: bot-only posts: daily attendance summary, weekly rollup, strike-threshold alerts.
- `#admin-controls`: where admins run `/handover`, `/handoverall`, `/report`, `/batches`.

**MY DESK** (category, initially empty)
- Per-rep private channels are created automatically by `/verify`. Each one is that rep's personal feed: a mirror of their own check-ins, stand-ups, excuses, prospects and follow-ups, plus personal nudges (missed check-in, under-quota, due follow-ups with buttons) and handover notices. Set the category's permissions to deny `@everyone` View Channel; each channel's own overwrites then restrict it to the rep and `@Admin`.

Any other channels (`#community-lounge`, `#shoutouts`, work or team channels) are up to you. The bot doesn't use them.

## IDs you'll need for `wrangler.toml`

Enable Developer Mode (User Settings → Advanced → Developer Mode), then right-click and **Copy ID**:
- `GUILD_ID`: the server icon
- `ADMIN_ROLE_ID`, `REP_ROLE_ID`: the roles (Server Settings → Roles)
- `CHECKIN_CHANNEL_ID`, `ADMIN_DASHBOARD_CHANNEL_ID`, `LEADERBOARD_CHANNEL_ID`: the channels
- `MY_DESK_CATEGORY_ID`: the "MY DESK" category

## Permissions

**The bot.** Give the bot's auto-created role the **Administrator** permission. That bypasses per-channel permission checks, so it can post anywhere and create private channels without "Missing Access" errors. If you prefer least privilege, it needs View Channel, Send Messages, Embed Links, Read Message History (and Manage Channels and Manage Roles for `/verify`) in every channel it uses.

**Humans.** Set these under each channel's Edit Channel → Permissions. *Read Message History* is a separate toggle from *View Channel*. Without it, someone can see new messages but can't scroll back.

| Channel | `@everyone` | `@Rep` | `@Admin` |
|---|---|---|---|
| `#rules-and-how-it-works` | View, Read History; no Send | inherits | View, Send, Read History |
| `#introductions`, `#verify` | View, Send, Read History | inherits | inherits |
| `#check-in`, `#wins` | no View | View, Send, Read History | View, Send, Read History |
| `#leaderboard` | no View | View, Read History; **no Send** (bot-only) | View, Send, Read History |
| `#admin-dashboard`, `#admin-controls` | no View | no View | View, Send, Read History |
| MY DESK category | no View | no View | View, Send, Read History |
| `desk-<name>` (one per rep) | no View | n/a | View, Send, Read History |

**Desk channels are per person, not per role.** Granting View on `@Rep` would let every rep see every other rep's channel. The bot instead adds an override for that one member (plus `@Admin` and itself, each with View, Send and Read History) when it creates the channel, so you shouldn't need to edit these by hand.

## Rules text template

Paste into `#rules-and-how-it-works` and adapt the numbers to your own policy.
These defaults match `wrangler.toml` and `src/strikes.js`.

```
Welcome to the team. Lost at any point? Run /help for the full command list.

1. Run /verify to get access and your own private desk channel.
2. Work days are [Sunday–Friday]. [Saturday] is off: no check-in, no quota.
3. On work days, run /checkin first thing, then /standup (DMs sent yesterday,
   today's plan, blockers). Attendance is tracked automatically.
4. Can't make it, or won't hit your quota today? Run /excuse with a reason
   before the cutoff. A real reason means no penalty.
5. Daily quota: [50] outreach messages (new prospects + follow-ups).
   No check-in and no excuse by [cutoff time] = an unexcused absence.
   Present but under quota with no excuse = a miss.
   [3] unexcused absences = 1 strike. [4] misses = 1 strike.
   Reaching [3] strikes in a 2-month period triggers a manager review.
   Strikes reset each 2-month period.
6. Log every new prospect with /newprospect. Follow-ups come due every
   [3] days; you'll get a reminder with buttons in your desk channel.
7. A prospect already closed by someone else is off-limits. /newprospect
   will refuse it automatically.
8. Points are tracked in #leaderboard (see "How points work" below).
9. Share wins with /win.
10. Managers can see attendance, activity and strikes at any time.
```

## How points work (template)

Post as its own message. These values come from `src/leaderboard.js`.

```
HOW LEADERBOARD POINTS WORK

Your weekly score is four things added together:

1. DMs, 1 point each (self-reported).
   In /standup you say how many DMs you sent yesterday. That number is your
   DM points. (This is the only self-reported part. Your attendance quota is
   counted automatically from real /newprospect and /followup usage.)
2. New prospects, 3 points each (/newprospect).
3. Follow-ups, 2 points each (/followup or the reminder buttons).
4. Closed deals, +10 bonus: a /followup that closes a prospect as
   Closed Won earns its 2 points plus 10.

Standings reset at the start of each week. Check anytime with /leaderboard.
```

If you change the quota, the cutoff time, or the follow-up interval in `wrangler.toml`, update the matching numbers in your pinned text.
