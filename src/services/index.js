// src/services/index.js
// Clean exports for service components

// Discord services
const DiscordNotificationManager = require('./discord/DiscordNotificationManager');

module.exports = {
  // Discord services
  discord: {
    DiscordNotificationManager
  }
};
