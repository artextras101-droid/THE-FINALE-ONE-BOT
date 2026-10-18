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

  client.on('packet', (data, metadata) => {
    // 1. Keep-Alive validation loop
    if (metadata.name === 'keep_alive') {
      try {
        client.write('keep_alive', { keepAliveId: data.keepAliveId });
      } catch (e) {}
    }

    // 2. Intercept Velocity Netty Cookie Requests
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

    // 4. Force state completion during configuration handshake
    if (metadata.name === 'finish_configuration' || (metadata.name === 'registry_data' && client.state === 'configuration')) {
      try {
        client.write('finish_configuration', {});
      } catch (e) {}
    }

    // 5. CRITICAL FIX: Send client commands immediately on entering play mode
    if (metadata.name === 'login' && client.state === 'play') {
      try {
        // Send default client preferences
        client.write('settings', {
          locale: 'en_US', viewDistance: 4, chatFlags: 0, chatColors: true,
          skinParts: 127, mainHand: 1, enableTextFiltering: false, allowServerListings: true
        });

        // IMMEDIATELY signal to the server that we are performing a safe login spawn
        client.write('client_command', { actionId: 0 }); // Action 0 is 'Perform respawn/initial login confirmation'
        console.log("[World Sync] Sent instant client confirmation commands.");
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
    // Gracefully catch background noise to maintain system uptime
  });
}

function startChatLoop(client) {
  clearInterval(chatInterval);
  let index = 0;

  chatInterval = setInterval(() => {
    if (!botState.connected) return;
    try {
      client.write('chat', { message: config.chat.messages[index] });
      index = (index + 1) % config.chat.messages.length;
    } catch (e) {}
  }, config.chat.repeatDelay * 1000);
}

createBotInstance();
