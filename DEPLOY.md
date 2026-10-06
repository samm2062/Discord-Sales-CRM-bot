# Deploy guide

Do these in order. Everything here runs on free tiers at small-team scale.
(The one limit you'll hit is Cloudflare's free plan allowing **5 cron triggers
per account**. `wrangler.toml` already fits within that.)

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications → **New Application**.
2. **Bot** → **Reset Token**, copy it somewhere safe. This is `DISCORD_BOT_TOKEN`.
3. No privileged Gateway intents are needed, since this bot doesn't use the Gateway.
4. **General Information** → copy the **Application ID** (`DISCORD_APPLICATION_ID`) and **Public Key** (`DISCORD_PUBLIC_KEY`).
5. **OAuth2 → URL Generator**: scopes `bot` and `applications.commands`; permissions `Manage Roles`, `Manage Channels`, `Send Messages`, `Embed Links`, `Add Reactions`, `Read Message History`. Open the generated URL and invite the bot to a **test server** first.

## 2. Create the Google Sheet and service account

1. Create a Google Sheet with the tabs and headers in [`SHEET_SCHEMA.md`](./SHEET_SCHEMA.md). Copy the **Spreadsheet ID** from its URL.
2. In https://console.cloud.google.com create a project and enable the **Google Sheets API**.
3. **Credentials → Create Credentials → Service Account**, then **Keys → Add Key → JSON**. From the downloaded file you need:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` sequences)
4. Share the Sheet with the `client_email` address as **Editor**.

## 3. Install

You need Node.js (LTS) and a free Cloudflare account.

```bash
npm install
```

## 4. Configure `wrangler.toml`

Fill in the `[vars]` (these are non-secret):
- `DISCORD_PUBLIC_KEY`, `DISCORD_APPLICATION_ID`: from step 1
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `SPREADSHEET_ID`: from step 2
- `GUILD_ID`, `ADMIN_ROLE_ID`, `REP_ROLE_ID`, the channel and category IDs: from [`SERVER_SETUP.md`](./SERVER_SETUP.md) (build the server structure first)
- `FOLLOWUP_INTERVAL_DAYS`: days between the 3 follow-ups (default 3)
- `DAILY_DM_QUOTA`: minimum daily outreach count (default 50)
- `STRIKE_THRESHOLD`: strikes in a 2-month period before admins are alerted (default 3). The alert is a notice only; nothing is automated. Note that "3 absences = 1 strike" and "4 under-quota days = 1 strike" are constants in `src/strikes.js`.

The cron times in `[triggers]` are **UTC** and are set for UTC+5:45 (Kathmandu)
with a Sunday to Friday work week. Adjust them for your timezone and work week.
Cloudflare numbers weekdays **1 to 7 with Sunday = 7**, so Sun to Fri is `1-5,7`.
If you change a cron string, change the matching `case` in `src/index.js`.

## 5. Set secrets (never in `wrangler.toml`)

```bash
npx wrangler login
npx wrangler secret put DISCORD_BOT_TOKEN
npx wrangler secret put GOOGLE_PRIVATE_KEY
```

Run each command on its own. The command only takes the secret's **name**; it
then prompts you to paste the **value** on a separate line. Don't put the value
on the command line.

## 6. Deploy

```bash
npm run deploy
```

This prints a URL like `https://<worker-name>.<your-subdomain>.workers.dev`.

## 7. Wire the Interactions endpoint

Discord Developer Portal → **General Information** → paste the Worker URL into
**Interactions Endpoint URL** → Save. Discord sends a signed test request. If it
fails, check that `DISCORD_PUBLIC_KEY` matches and the deploy succeeded.

## 8. Register the slash commands

The script reads three environment variables. Set them for your shell:

```bash
# macOS / Linux / Git Bash
export DISCORD_APPLICATION_ID=... GUILD_ID=... DISCORD_BOT_TOKEN=...
# Windows cmd:         set DISCORD_APPLICATION_ID=...  (one per line)
# Windows PowerShell:  $env:DISCORD_APPLICATION_ID = "..."  (one per line)

npm run register
```

Guild-scoped commands appear instantly. Re-run this whenever you add or change a
command's name or options.

## 9. Test on a test server first

Run through `/help`, `/verify`, `/checkin`, `/excuse`, `/standup`, `/newprospect`,
`/followup`, `/win`, `/myprospects`, `/leaderboard`, and as an admin `/handover`,
`/handoverall`, `/report`, `/batches`. Check the sheet after each. Also try
`/newprospect` on a prospect you've marked `Closed Won`. It should refuse.

**To test scheduled jobs without waiting**, copy `.dev.vars.example` to
`.dev.vars` and fill in the two secrets (local dev doesn't read your deployed
secrets), then:

```bash
npx wrangler dev --test-scheduled
# in a second terminal (use one of your cron strings from wrangler.toml):
curl "http://localhost:8787/__scheduled?cron=15+8+*+*+1-5,7"
```

To see the follow-up buttons, create a prospect and set its `followup1_date`
to today in the sheet before triggering the attendance and follow-up cron.

## 10. Go live

Build the real server per `SERVER_SETUP.md`, invite the bot, update `GUILD_ID`
and the role/channel IDs in `wrangler.toml`, run `npm run deploy` and
`npm run register` again, then onboard reps with `/verify`.
