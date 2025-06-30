
module.exports.run = async (conn, m) => {
    await conn.sendMessage(m.key.remoteJid, { text: "✅ I am alive bot is working!" }, { quoted: m });
};
