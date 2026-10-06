import { commands } from "./definitions.js";
import { isAdmin } from "../config.js";

// Builds the list straight from definitions.js rather than a separate
// hardcoded list, so it can never drift out of sync when commands change.
// Admin-only commands (description starts with "[Admin]") are hidden from
// non-admins entirely — they shouldn't even know those commands exist.
export default async function help(env, interaction) {
  const admin = isAdmin(env, interaction);
  const visible = commands.filter((c) => admin || !c.description.startsWith("[Admin]"));
  const lines = visible.map((c) => `**/${c.name}** — ${c.description}`);

  return {
    flags: 64,
    embeds: [
      {
        title: "Commands",
        color: 0x5865f2,
        description: lines.join("\n"),
      },
    ],
  };
}
