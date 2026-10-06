// Slash command definitions, pushed to Discord by scripts/register-commands.js.
// Options are required wherever the field is mandatory for the CRM data to be
// useful — this is what forces structured input instead of a blank text box.

const OUTCOME_CHOICES = [
  { name: "Replied", value: "Replied" },
  { name: "Seen, No Reply", value: "Seen, No Reply" },
  { name: "No Response", value: "No Response" },
  { name: "Not Interested", value: "Not Interested" },
  { name: "Deal Progressing", value: "Deal Progressing" },
  { name: "Closed Won", value: "Closed Won" },
  { name: "Closed Lost", value: "Closed Lost" },
];

export const commands = [
  {
    name: "help",
    description: "List every command and what it's for",
  },
  {
    name: "checkin",
    description: "Mark yourself present for today",
  },
  {
    name: "excuse",
    description: "Give a reason you won't be checking in or hitting quota today — avoids a strike",
    options: [
      { name: "reason", description: "Why (e.g. \"sick\", \"family event\")", type: 3, required: true },
    ],
  },
  {
    name: "standup",
    description: "Log your daily stand-up",
    options: [
      { name: "dms_yesterday", description: "How many DMs did you send yesterday? (1 pt each on the leaderboard)", type: 4, required: true },
      { name: "today", description: "What you're doing today", type: 3, required: true },
      { name: "blockers", description: "Anything blocking you (or \"none\")", type: 3, required: true },
    ],
  },
  {
    name: "newprospect",
    description: "Log a new prospect you've DM'd — starts the 3-stage follow-up clock",
    options: [
      { name: "prospect", description: "Prospect's name or @handle", type: 3, required: true },
      { name: "brand", description: "Brand / niche", type: 3, required: true },
      {
        name: "platform",
        description: "Where you reached out",
        type: 3,
        required: true,
        choices: [
          { name: "Instagram", value: "Instagram" },
          { name: "TikTok", value: "TikTok" },
          { name: "Twitter/X", value: "Twitter/X" },
          { name: "LinkedIn", value: "LinkedIn" },
          { name: "Email", value: "Email" },
          { name: "Other", value: "Other" },
        ],
      },
      { name: "notes", description: "First message / context", type: 3, required: true },
    ],
  },
  {
    name: "followup",
    description: "Log a follow-up touch on an existing prospect",
    options: [
      { name: "prospect", description: "Prospect's name or @handle", type: 3, required: true },
      { name: "outcome", description: "What happened", type: 3, required: true, choices: OUTCOME_CHOICES },
      { name: "notes", description: "What you said / what they said", type: 3, required: true },
      { name: "deal_stage", description: "Update deal stage (optional)", type: 3, required: false },
      { name: "revenue", description: "Revenue if closed won (optional)", type: 10, required: false },
    ],
  },
  {
    name: "win",
    description: "Share a win with the team",
    options: [
      { name: "title", description: "Short headline", type: 3, required: true },
      { name: "details", description: "Details (optional)", type: 3, required: false },
    ],
  },
  {
    name: "myprospects",
    description: "See your prospects and when their next follow-up is due",
  },
  {
    name: "leaderboard",
    description: "Check the current week's points standings",
  },
  {
    name: "handover",
    description: "[Admin] Reassign a prospect from one rep to another",
    options: [
      { name: "from", description: "Current owner", type: 6, required: true },
      { name: "to", description: "New owner", type: 6, required: true },
      { name: "prospect", description: "Prospect's name or @handle", type: 3, required: true },
      { name: "reason", description: "Why this is happening", type: 3, required: true },
    ],
  },
  {
    name: "handoverall",
    description: "[Admin] Reassign ALL of one rep's open prospects to another rep at once",
    options: [
      { name: "from", description: "Current owner", type: 6, required: true },
      { name: "to", description: "New owner", type: 6, required: true },
      { name: "reason", description: "Why this is happening (e.g. left the team)", type: 3, required: true },
    ],
  },
  {
    name: "report",
    description: "[Admin] Pull an attendance/activity report",
    options: [
      {
        name: "scope",
        description: "Time range",
        type: 3,
        required: true,
        choices: [
          { name: "Today", value: "today" },
          { name: "This week", value: "week" },
        ],
      },
    ],
  },
  {
    name: "batches",
    description: "[Admin] See reps grouped by hiring batch (2-month cohorts)",
  },
  {
    name: "verify",
    description: "Complete onboarding: get the Rep role and your private desk channel",
  },
];
