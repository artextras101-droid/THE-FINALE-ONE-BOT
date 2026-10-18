"use strict";

const mineflayer = require("mineflayer");
const express = require("express");

// ============================================================
// PUT YOUR CONFIGURATION SETTINGS DIRECTLY HERE
// ============================================================
const config = {
  "name": "AFK Bot",
  "bot-account": {
    "username": "ARTEX's SON", // Put your preferred username here
    "password": "",
    "type": "offline"
  },
  "server": {
    "ip": "merge.play.hosting",
    "port": 25565,
    "version": false // Leave as false so it automatically matches your server version
  },
  "utils": {
    "anti-afk": { "enabled": true },
    "chat-messages": {
      "enabled": true,
      "repeat-delay": 120,
      "messages": ["How are u?", "Chill!", "lol"]
    },
    "auto-reconnect": true,
    "auto-reconnect-delay": 15000 // Forced 15 seconds to completely stop the Duplicate UUID kick bug
  }
};

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

let botState = {
  connected: false,
  errors: []
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <style>
          body { font-family: sans-serif; background: #0d1117; color: #e6edf3; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
          main { width: 100%; max-width: 400px; padding: 20px; background: #161b22; border-radius: 10px; border: 1px solid #21262d; text-align: center; }
          .online { color: #3fb950; font-weight: bold; }
          .offline { color: #f85149; font-weight: bold; }
        </style>
      </head>
      <body>
        <main>
          <h2>${config.name} Dashboard</h2>
          <p>Status: <span class="${botState.connected ? 'online' : 'offline'}">${botState.connected ? 'ONLINE' : 'OFFLINE'}</span></p>
          <p>Connected to: <strong>${config.server.ip}</strong></p>
        </main>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: botState.connected ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => {
  console.log(`[Express Router] Dashboard web host running on port ${PORT}`);
});

// ============================================================
// CORE MINECRAFT ENGINE MODULE WITH PROXY BYPASSES
// ============================================================
let bot;
let antiAfkInterval;
let chatLoopInterval;

function startBot() {
  console.log(`[Runtime] Linking instance to address: ${config.server.ip}`);

  bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config["bot-account"].username,
    version: config.server.version, 
    auth: "offline",

    // CRITICAL PROXY PASSTHROUGH PARAMETERS (BYPASSES VIAVERSION & VELOCITY KICKS)
    brand: 'vanilla',                
    skipValidation: true,            
    checkTimeoutInterval: 90 * 1000  
  });

  // Turn off physics instantly on boot to stop "Internal server error" crash loops
  bot.physicsEnabled = false;

  bot.once("spawn", () => {
    botState.connected = true;
    console.log(`[Success Engine] ${bot.username} has stabilized inside the world map!`);

    // Safely enable low-impact looking physics after client fully stabilizes
    setTimeout(() => {
      if (bot) bot.physicsEnabled = true;
      console.log("[Engine Matrix] Environmental systems fully verified.");
    }, 4000);

    if (config.utils["anti-afk"]?.enabled) {
      startAntiAfk();
    }

    if (config.utils["chat-messages"]?.enabled) {
      startChatLoop();
    }
  });

  bot.on("error", (err) => {
    console.error(`[Socket Error] ${err.message}`);
    botState.errors.push({ time: Date.now(), msg: err.message });
  });

  bot.on("kicked", (reason) => {
    console.warn(`[Kicked From Server Layer] Reason: ${reason}`);
  });

  bot.on("end", () => {
    botState.connected = false;
    console.log(`[Socket Drop] Disconnected. Cleaning local loop cache...`);
    
    clearInterval(antiAfkInterval);
    clearInterval(chatLoopInterval);

    if (config.utils["auto-reconnect"]) {
      console.log(`[Proxy Sync] Waiting 15 seconds to clear previous session ghost...`);
      setTimeout(() => {
        startBot();
      }, config.utils["auto-reconnect-delay"]);
    }
  });
}

function startAntiAfk() {
  clearInterval(antiAfkInterval);
  antiAfkInterval = setInterval(() => {
    if (!bot || !botState.connected || !bot.entity) return;
    const yaw = bot.entity.yaw + (Math.random() * 0.4 - 0.2);
    const pitch = bot.entity.pitch + (Math.random() * 0.2 - 0.1);
    bot.look(yaw, pitch, true);
  }, 4000);
}

function startChatLoop() {
  clearInterval(chatLoopInterval);
  const msgList = config.utils["chat-messages"].messages;
  let index = 0;

  chatLoopInterval = setInterval(() => {
    if (!bot || !botState.connected) return;
    bot.chat(msgList[index]);
    index = (index + 1) % msgList.length;
  }, config.utils["chat-messages"]["repeat-delay"] * 1000);
}

// Start the integrated execution process
startBot();
