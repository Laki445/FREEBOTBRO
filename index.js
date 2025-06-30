
const express = require('express');
const pino = require('pino');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

const logger = pino({ level: 'silent' });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.get("/", (_, res) => res.sendFile(__dirname + "/public/pair.html"));

async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        logger
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
        if (connection === "close") {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startSock();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const msg = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const from = m.key.remoteJid;

        if (msg.startsWith(".")) {
            const command = msg.slice(1).split(" ")[0];
            const pluginPath = path.join(__dirname, "plugins", `${command}.js`);
            if (fs.existsSync(pluginPath)) {
                try {
                    const plugin = require(pluginPath);
                    await plugin.run(sock, m, msg);
                } catch (e) {
                    await sock.sendMessage(from, { text: "Plugin error ❌" }, { quoted: m });
                }
            }
        }
    });
}

startSock();
app.listen(PORT, () => console.log("Bot Server Running on Port", PORT));
