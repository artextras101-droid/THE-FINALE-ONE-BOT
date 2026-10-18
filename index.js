"use strict";

const mineflayer = require("mineflayer");
const express = require("express");

// ============================================================
// CONFIGURATION OVERRIDE MATRIX
// ============================================================
const config = {
  "name": "AFK Bot",
  "bot-account": {
    "username": "ARTEX's SON",
    "password": "",
    "type": "offline"
  },
  "server": {
    "ip": "merge.play.hosting",
    "port": 25565,
    "version": false
  },
  "utils": {
    "anti-afk": { "enabled": true },
    "chat-messages": {
      "enabled": true,
      "repeat-delay": 120,
      "messages": ["How are u?", "Chill!", "lol"]
    },
    "auto-reconnect": true,
    "auto-reconnect-delay": 15000
  }
};

// ============================================================
// EXPRESS WEB ENGINE (KEEP ALIVE ROUTER)
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

let botState = { connected: false };

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
          <p>Node Target: <strong>${config.server.ip}</strong></p>
        </main>
      </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: botState.connected ? 'connected' : 'disconnected' });
});

app.listen(PORT, () => {
  console.log(`[Web Dynamic Router] Monitoring portal operational on port ${PORT}`);
});

// ============================================================
// CORE BOT CLIENT MATRIX (PROXY INJECTION PATCH)
// ============================================================
let bot;
let antiAfkInterval;
let chatLoopInterval;

function startBot() {
  console.log(`[Client Engine] Binding automated socket to address: ${config.server.ip}`);

  bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config["bot-account"].username,
    version: config.server.version, 
    auth: "offline",
    brand: 'vanilla',                
    skipValidation: true,            
    checkTimeoutInterval: 90 * 1000  
  });

  bot.physicsEnabled = false;

  // CRITICAL SEED: Intercept modern 1.21+ configuration phase packets to bypass Netty dropouts
  bot.on('packet', (data, metadata) => {
    if (metadata.name === 'select_known_packs' && bot._client?.state === 'configuration') {
      try {
        bot._client.write('select_known_packs', { knownPacks: [] });
      } catch (e) {}
    }
  });

  bot.once("spawn", () => {
    botState.connected = true;
    console.log(`[Success Hook] Profile ${bot.username} has stabilized in the game grid.`);

    setTimeout(() => {
      if (bot) bot.physicsEnabled = true;
      console.log("[Engine Matrix] Tracking sub-modules initialized cleanly.");
    }, 4000);

    if (config.utils["anti-afk"]?.enabled) {
      startAntiAfk();
    }

    if (config.utils["chat-messages"]?.enabled) {
      startChatLoop();
    }
  });

  bot.on("error", (err) => {
    console.error(`[Socket Interface Exception] ${err.message}`);
  });

  bot.on("end", () => {
    botState.connected = false;
    console.log(`[Socket Interrupted] Network gateway closed. Clearing context timers...`);
    
    clearInterval(antiAfkInterval);
    clearInterval(chatLoopInterval);

    if (config.utils["auto-reconnect"]) {
      console.log(`[Proxy Cooldown] Throttling reconnect loops by 15s to flush ViaVersion session data...`);
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

startBot();
