"use strict";

const mc = require("minecraft-protocol");
const express = require("express");

const config = {
  host: "merge.play.hosting",
  port: 25565,
  username: "ARTEX_SON_AFK" // Replaced special characters to bypass proxy username regex filters
};

const app = express();
app.listen(process.env.PORT || 8080, () => console.log("Web server online."));

function createBotInstance() {
  console.log(`[Connecting via Core Protocol] Targeting ${config.host}`);
  
  const client = mc.createClient({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false, // Auto-negotiates the handshake phase protocol version natively
    auth: 'offline',
    hideErrors: true
  });

  client.on('success', () => {
    console.log("[Success] Connection pipeline locked. Bot is standing in server memory.");
  });

  client.on('end', () => {
    console.log("[Interrupted] Disconnected from host proxy node. Re-engaging in 15s...");
    setTimeout(createBotInstance, 15000);
  });

  client.on('error', (err) => {
    // Silently handle packet dropouts to maintain system uptime
  });
}

createBotInstance();
