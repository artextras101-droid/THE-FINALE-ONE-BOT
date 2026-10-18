"use strict";

const mc = require("minecraft-protocol");
const express = require("express");

const config = {
  host: "MERGESMO.aternos.me",
  port: 23887,
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

    // 4. CRITICAL DISCONNECT FIX: Provide full client settings during the configuration state
    if (metadata.name === 'select_known_packs' || metadata.name === 'registry_data') {
      try {
        // Forces the proxy to register client parameters before finishing configuration
        client.write('client_information', {
          locale: 'en_US',
          viewDistance: 4,
          chatFlags: 0,
          chatColors: true,
          skinParts: 127,
          mainHand: 1,
          enableTextFiltering: false,
          allowServerListings: true
        });
        
        client.write('finish_configuration', {});
      } catch (e) {}
    }

    if (metadata.name === 'custom_payload' || metadata.name === 'plugin_message') {
      try {
        if (data.channel === 'minecraft:brand' || data.channel === 'brand') {
          const brandString = "vanilla";
          const dataBuffer = Buffer.alloc(brandString.length + 1);
          dataBuffer.writeUInt8(brandString.length, 0);
          dataBuffer.write(brandString, 1);
          client.write('custom_payload', { channel: data.channel, data: dataBuffer });
        }
      } catch (e) {}
    }

    // 5. Spawn World Activation Sequence
    if (metadata.name === 'login' && client.state === 'play') {
      try {
        client.write('client_command', { actionId: 0 });

        client.write('chat_session_update', {
          sessionInfo: {
            sessionId: require('crypto').randomBytes(16),
            expiresAt: BigInt(0), publicKey: Buffer.alloc(0), keySignature: Buffer.alloc(0)
          }
        });
        
        startHeartbeat(client);
        console.log("[Handshake Complete] Bot successfully bound to active world layer.");
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
    console.log("[Interrupted] Disconnected from proxy node. Re-engaging in 15s...");
    clearInterval(chatInterval);
    clearInterval(heartbeatInterval);
    setTimeout(createBotInstance, 15000);
  });

  client.on('error', () => {});
}

function startHeartbeat(client) {
  clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (!botState.connected) return;
    try {
      client.write('position', { x: 0.0, y: 70.0, z: 0.0, onGround: true });
    } catch (e) {}
  }, 1500);
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
