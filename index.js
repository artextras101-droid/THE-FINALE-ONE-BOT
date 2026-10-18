"use strict";

const mc = require("minecraft-protocol");
const express = require("express");

// ============================================================
// EMBEDDED CONFIGURATION LAYERS
// ============================================================
const config = {
  host: "merge.play.hosting",
  port: 25565,
  username: "ARTEX_SON_AFK",
  chat: {
    enabled: true,
    repeatDelay: 120, 
    messages: ["How are u?", "Chill!", "lol"]
  }
};

// ============================================================
// EXPRESS WEB ENGINE (KEEP ALIVE PORT ROUTER)
// ============================================================
const app = express();
let botState = { connected: false };

app.get('/', (req, res) => {
  res.send(`<h1>Bot Status: ${botState.connected ? 'ONLINE' : 'OFFLINE'}</h1>`);
});

app.listen(process.env.PORT || 8080, () => {
  console.log("Web server online.");
});

// ============================================================
// CORE BOT CLIENT ENGINE (VELOCITY COMPLETION PATCH)
// ============================================================
let chatInterval;

function createBotInstance() {
  console.log(`[Connecting via Core Protocol] Targeting ${config.host}`);
  
  const client = mc.createClient({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false, 
    auth: 'offline',
    hideErrors: true
  });

  // Intercept and bypass server-side resource pack arrays matching 1.21 protocols
  client.on('packet', (data, metadata) => {
    // 1. Standalone Keep-Alive verification loop
    if (metadata.name === 'keep_alive') {
      try {
        client.write('keep_alive', { keepAliveId: data.keepAliveId });
      } catch (e) {}
    }

    // 2. Intercept modern Velocity Netty Cookie Requests
    if (metadata.name === 'cookie_request') {
      try {
        client.write('cookie_response', {
          key: data.key,
          hasPayload: false,
          payload: Buffer.alloc(0)
        });
      } catch (e) {}
    }

    // 3. Bypass 1.21+ network resource configuration checks
    if (metadata.name === 'select_known_packs' && client.state === 'configuration') {
      try {
        client.write('select_known_packs', { knownPacks: [] });
      } catch (e) {}
    }

    // 4. CRITICAL FIX: Tell the proxy the client successfully loaded the configuration phase
    if (metadata.name === 'finish_configuration' || (metadata.name === 'registry_data' && client.state === 'configuration')) {
      try {
        client.write('finish_configuration', {});
      } catch (e) {}
    }
  });

  client.on('success', () => {
    botState.connected = true;
    console.log("[Success] Connection pipeline locked. Bot has spawned on the server roster!");
    
    if (config.chat.enabled) {
      startChatLoop(client);
    }
  });

  client.on('end', () => {
    botState.connected = false;
    console.log("[Interrupted] Disconnected from host proxy node. Re-engaging in 15s...");
    clearInterval(chatInterval);
    setTimeout(createBotInstance, 15000);
  });

  client.on('error', (err) => {
    // Gracefully handle internal drops to maintain 24/7 uptime
  });
}

function startChatLoop(client) {
  clearInterval(chatInterval);
  let index = 0;

  chatInterval = setInterval(() => {
    if (!botState.connected) return;
    try {
      // Modern packet layout structure for direct chat injection strings
      client.write('chat', { message: config.chat.messages[index] });
      index = (index + 1) % config.chat.messages.length;
    } catch (e) {}
  }, config.chat.repeatDelay * 1000);
}

// Start the engine
createBotInstance();
