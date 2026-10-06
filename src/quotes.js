// Short motivational quotes for the morning check-in prompt. One is picked
// at random each workday (Sun-Fri) so the message doesn't feel identical every day.
export const QUOTES = [
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { text: "Every no gets you closer to a yes.", author: "unknown" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
  { text: "Opportunities don't happen, you create them.", author: "Chris Grosser" },
  { text: "Consistency is what transforms average into excellence.", author: "unknown" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "unknown" },
  { text: "Fall seven times, stand up eight.", author: "Japanese proverb" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Sales are contingent upon the attitude of the salesman, not the attitude of the prospect.", author: "William Clement Stone" },
  { text: "It's not about ideas. It's about making ideas happen.", author: "Scott Belsky" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Today's a great day to follow up with someone you almost gave up on.", author: "unknown" },
  { text: "Winners are not people who never fail, but people who never quit.", author: "unknown" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese proverb" },
];

export function randomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}
