"use strict";

const mc = require("minecraft-protocol");
const express = require("express");

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

const app = express();
let botState = { connected: false };
app.get('/', (req, res) => res.send(`<h1>Status: ${botState.connected ? 'ONLINE' : 'OFFLINE'}</h1>`));
app.listen(process.env.PORT || 8080, () => console.log("Web server online."));

let chatInterval;
let heartbeatInterval;

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
    // 1. Core Network Keep-Alive Loop
    if (metadata.name === 'keep_alive') {
      try { client.write('keep_alive', { keepAliveId: data.keepAliveId }); } catch (e) {}
    }

    // 2. Intercept Velocity Proxy Cookie Requests
    if (metadata.name === 'cookie_request') {
      try {
        client.write('cookie_response', { key: data.key, hasPayload: false, payload: Buffer.alloc(0) });
      } catch (e) {}
    }

    // 3. Bypass Network Configuration Handshake Checks
    if (metadata.name === 'select_known_packs' && client.state === 'configuration') {
      try { client.write('select_known_packs', { knownPacks: [] }); } catch (e) {}
    }

    if (metadata.name === 'finish_configuration' || (metadata.name === 'registry_data' && client.state === 'configuration')) {
      try { client.write('finish_configuration', {}); } catch (e) {}
    }

    // 4. Handle proxy network custom channel payloads to prevent timeouts
    if (metadata.name === 'custom_payload' || metadata.name === 'plugin_message') {
      try {
        client.write('custom_payload', { channel: data.channel, data: Buffer.alloc(0) });
      } catch (e) {}
    }

    // 5. Spawn World Activation Sequence
    if (metadata.name === 'login' && client.state === 'play') {
      try {
        client.write('settings', {
          locale: 'en_US', viewDistance: 4, chatFlags: 0, chatColors: true,
          skinParts: 127, mainHand: 1, enableTextFiltering: false, allowServerListings: true
        });

        client.write('client_command', { actionId: 0 });

        client.write('chat_session_update', {
          sessionInfo: {
            sessionId: require('crypto').randomBytes(16),
            expiresAt: BigInt(0), publicKey: Buffer.alloc(0), keySignature: Buffer.alloc(0)
          }
        });
        
        // TIMEOUT FIX: Start sending active player ticks so the proxy keeps the session open
        startHeartbeat(client);
        console.log("[Fixed Timeout] Position heartbeat and connection ticks active.");
      } catch (e) {}
    }
  });

  client.on('success', () => {
    botState.connected = true;
    console.log("[Success] Connection pipeline locked. Bot is standing in server memory.");
    if (config.chat.enabled) startChatLoop(client);
  });

  client.on('end', () => {
    botState.connected = false;
    console.log("[Interrupted] Disconnected. Re-engaging in 15s...");
    clearInterval(chatInterval);
    clearInterval(heartbeatInterval);
    setTimeout(createBotInstance, 15000);
  });

  client.on('error', () => {});
}

// Sends basic position tracking packets to the server every 2 seconds so you never time out
function startHeartbeat(client) {
  clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (!botState.connected) return;
    try {
      // Sends a "player is safely standing on the ground" update packet
      client.write('position', {
        x: 0.0,
        y: 70.0,
        z: 0.0,
        onGround: true
      });
    } catch (e) {}
  }, 2000);
}

function startChatLoop(client) {
  clearInterval(chatInterval);
  let index = 0;
  chatInterval = setInterval(() => {
    if (!botState.connected) return;
    try {
      client.write('chat_message', {
        message: config.chat.messages[index],
        timestamp: BigInt(Date.now()), salt: BigInt(0),
        signature: Buffer.alloc(0), offset: 0, acknowledged: Buffer.alloc(0)
      });
      index = (index + 1) % config.chat.messages.length;
    } catch (e) {}
  }, config.chat.repeatDelay * 1000);
}

createBotInstance();
