// Start the bot immediately. Do NOT block startup by synchronously registering
// commands here — that adds several seconds of delay and causes Discord
// interactions to time out with "The application did not respond".
// Register slash commands manually with `npm run register` (only needed when
// the command definitions change).
require('./bot');
