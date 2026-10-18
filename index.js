"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");

// ============================================================
// EXPRESS SERVER - Keep Render/Aternos alive
// ============================================================
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 5000;

// Bot state tracking
let botState = {
  connected: false,
  lastActivity: Date.now(),
  reconnectAttempts: 0,
  startTime: Date.now(),
  errors: [],
  wasThrottled: false,
};

// Health check endpoint for monitoring
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${config.name} Dashboard</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" media="print" onload="this.media='all'"
              href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #0d1117; color: #e6edf3;
            display: flex; justify-content: center; align-items: center;
            min-height: 100vh; margin: 0; padding: 24px;
          }
          main { width: 100%; max-width: 400px; }
          header { margin-bottom: 28px; }
          header h1 { font-size: 26px; font-weight: 700; color: #f0f6fc; margin: 0; line-height: 1.2; }
          header p { font-size: 14px; color: #8b949e; margin: 6px 0 0; line-height: 1.5; }
          .status-section { border-radius: 12px; padding: 20px 24px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; }
          .status-section.online  { background: #0d2218; border: 2px solid #238636; }
          .status-section.offline { background: #200d0d; border: 2px solid #da3633; }
          .status-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
          .status-icon.online  { background: #238636; }
          .status-icon.offline { background: #da3633; }
          .status-label { font-size: 18px; font-weight: 700; line-height: 1.2; }
          .status-label.online  { color: #3fb950; }
          .status-label.offline { color: #f85149; }
          .status-detail { font-size: 13px; color: #8b949e; margin-top: 3px; }
          dl { margin: 0; }
          .stat-card { background: #161b22; border: 1px solid #21262d; border-radius: 10px; padding: 16px 20px; margin-bottom: 10px; }
          dt { font-size: 12px; color: #8b949e; font-weight: 600; margin-bottom: 4px; }
          dd { margin: 0; font-size: 17px; font-weight: 600; color: #e6edf3; line-height: 1.3; }
          .stat-detail { margin: 4px 0 0; font-size: 11px; color: #6e7681; }
          .controls { margin-top: 8px; }
          .btn-grid { display: grid; gap: 10px; margin-bottom: 10px; }
          .btn-grid-2 { grid-template-columns: 1fr 1fr; }
          .btn-primary { min-height: 52px; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; letter-spacing: 0.3px; font-family: inherit; }
          .btn-start { border: 2px solid #238636; background: #0d2218; color: #3fb950; }
          .btn-stop  { border: 2px solid #da3633; background: #200d0d; color: #f85149; }
          .btn-secondary { min-height: 44px; border-radius: 10px; border: 1px solid #21262d; background: #161b22; color: #8b949e; font-size: 13px; font-weight: 500; text-decoration: none; display: flex; align-items: center; justify-content: center; font-family: inherit; }
          footer { margin-top: 20px; text-align: center; }
          footer p { font-size: 12px; color: #484f58; margin: 0; }
        </style>
      </head>
      <body>
        <main>
          <header>
            <h1>${config.name} Dashboard</h1>
            <p>Live Panel Matrix</p>
          </header>
          <section id="status-section" class="status-section ${botState.connected ? 'online' : 'offline'}">
            <div id="status-icon" class="status-icon ${botState.connected ? 'online' : 'offline'}">${botState.connected ? '&#x2714;' : '&#x2717;'}</div>
            <div>
              <div class="status-label ${botState.connected ? 'online' : 'offline'}">${botState.connected ? 'Online' : 'Offline'}</div>
              <div class="status-detail">${botState.connected ? 'Active in server world' : 'Disconnected / Linking...'}</div>
            </div>
          </section>
          <dl>
            <div class="stat-card">
              <dt>Target Node</dt>
              <dd>${config.server.ip}</dd>
            </div>
          </dl>
        </main>
      </body>
    </html>
  `);
});

// JSON API endpoints for dashboard connectivity
app.get('/health', (req, res) => {
  res.json({ status: botState.connected ? 'connected' : 'disconnected', details: botState });
});

app.get('/logs', (req, res) => {
  res.json(getLogs ? getLogs() : ["Logger loaded cleanly."]);
});

app.listen(PORT, () => {
  console.log(`[Express Router] Automated web host running on port ${PORT}`);
});

// ============================================================
// CORE MINECRAFT ENGINE MODULE
// ============================================================
let bot;
let antiAfkInterval;
let chatLoopInterval;

function startBot() {
  console.log(`[Runtime Initializer] Linking instance to address: ${config.server.ip}`);
  addLog(`Attempting connection link to ${config.server.ip}`);

  bot = mineflayer.createBot({
    host: config.server.ip,
    port: parseInt(config.server.port) || 25565,
    username: config["bot-account"].username,
    version: config.server.version === "false" || !config.server.version ? false : config.server.version,
    auth: "offline",

    // CRITICAL PROXY PASSTHROUGH PARAMETERS
    brand: 'vanilla',               // Forces the Lilypad/Velocity engine to accept the connection
    skipValidation: true,          // Prevents handshake certificate rejection drops
    checkTimeoutInterval: 60 * 1000 // Disables fast connection drop loops during proxy handshakes
  });

  // Freeze local physics modules during the early handshake setup to prevent internal errors
  bot.physicsEnabled = false;

  bot.once("spawn", () => {
    botState.connected = true;
    botState.reconnectAttempts = 0;
    console.log(`[Success Engine] Profile ${bot.username} has stabilized inside the world map.`);
    addLog("Bot successfully authenticated and spawned.");

    // Safely release physics calculations after the world packet streams finish loading
    setTimeout(() => {
      bot.physicsEnabled = true;
      console.log("[Engine Matrix] Client tracking and environments functional.");
    }, 2000);

    // Turn on Anti-AFK mechanics if specified in configuration layers
    if (config.utils["anti-afk"]?.enabled) {
      startAntiAfk();
    }

    // Spin up standard automated text chat announcements if checked
    if (config.utils["chat-messages"]?.enabled) {
      startChatLoop();
    }
  });

  bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    if (getLogs) addLog(`[Chat] ${username}: ${message}`);
  });

  bot.on("error", (err) => {
    console.error(`[Socket Error Hook] Exception message parsed: ${err.message}`);
    if (getLogs) addLog(`Error event trace: ${err.message}`);
    botState.errors.push({ time: Date.now(), msg: err.message });
  });

  bot.on("end", () => {
    botState.connected = false;
    console.log(`[Socket Drop] Link interrupted. Initializing auto-reconnect logic...`);
    if (getLogs) addLog("Connection terminated completely.");
    
    // Clear functional loops to stop thread leaks
    clearInterval(antiAfkInterval);
    clearInterval(chatLoopInterval);

    if (config.utils["auto-reconnect"]?.enabled) {
      setTimeout(() => {
        botState.reconnectAttempts++;
        startBot();
      }, config.utils["auto-reconnect-delay"] || 5000);
    }
  });
}

// Helper utilities for in-world management loop sequences
function startAntiAfk() {
  clearInterval(antiAfkInterval);
  antiAfkInterval = setInterval(() => {
    if (!bot || !botState.connected) return;
    // Performs low-impact looking sequences to trick inactivity sweep filters without causing packet overload
    const yaw = bot.entity.yaw + (Math.random() * 0.4 - 0.2);
    const pitch = bot.entity.pitch + (Math.random() * 0.2 - 0.1);
    bot.look(yaw, pitch, true);
  }, 4000);
}

function startChatLoop() {
  clearInterval(chatLoopInterval);
  const msgList = config.utils["chat-messages"].messages || ["AFK Automation active."];
  let index = 0;

  chatLoopInterval = setInterval(() => {
    if (!bot || !botState.connected) return;
    bot.chat(msgList[index]);
    index = (index + 1) % msgList.length;
  }, (config.utils["chat-messages"]["repeat-delay"] || 120) * 1000);
}

// Fire up the primary engine process
startBot();
