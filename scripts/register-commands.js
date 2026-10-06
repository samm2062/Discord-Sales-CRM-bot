// One-off script, run locally with Node (not part of the deployed Worker):
//   node scripts/register-commands.js
// Registers/overwrites all slash commands for your server (guild-scoped =
// instant availability, vs. up to an hour for global commands).
//
// Reads DISCORD_APPLICATION_ID, GUILD_ID, and DISCORD_BOT_TOKEN from
// environment variables — export them in your shell first, e.g.:
//   export DISCORD_APPLICATION_ID=...
//   export GUILD_ID=...
//   export DISCORD_BOT_TOKEN=...

import { commands } from "../src/commands/definitions.js";

const { DISCORD_APPLICATION_ID, GUILD_ID, DISCORD_BOT_TOKEN } = process.env;

if (!DISCORD_APPLICATION_ID || !GUILD_ID || !DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_APPLICATION_ID, GUILD_ID, or DISCORD_BOT_TOKEN in the environment.");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${DISCORD_APPLICATION_ID}/guilds/${GUILD_ID}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error(`Failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log(`Registered ${commands.length} commands to guild ${GUILD_ID}.`);
