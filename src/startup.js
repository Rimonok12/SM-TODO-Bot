const http = require('http');
const { execSync } = require('child_process');

// Run register commands on deploy
try {
  console.log('⏳ Registering slash commands...');
  execSync('node src/register-commands.js', { stdio: 'inherit' });
} catch (e) {
  console.error('Failed to register commands:', e.message);
}

// Then start the bot
require('./bot');
