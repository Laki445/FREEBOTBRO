
module.exports.run = async (conn, m) => {
    await conn.sendMessage(m.key.remoteJid, { text: "🏓 Pong! Bot online." }, { quoted: m });
};
