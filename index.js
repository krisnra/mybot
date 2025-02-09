const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("baileys");
const express = require("express");

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    if (update.connection === "close") {
      if (
        update.lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut
      ) {
        connectToWhatsApp();
      }
    } else if (update.connection === "open") {
      console.log("✅ WhatsApp Bot Connected!");
    }
  });

  let latestNumber = ""; // Simpan angka yang akan dikirim ke ESP32

  sock.ev.on("messages.upsert", async (event) => {
    if (event.messages[0].key.fromMe) return;

    for (const m of event.messages) {
      let msgText =
        m.message?.conversation || m.message?.extendedTextMessage?.text;
      let sender = m.key.remoteJid;

      console.log("📩 Pesan diterima:", msgText, "dari", sender);

      if (msgText === "/esp") {
        latestNumber = "31"; // Simpan angka yang akan dikirim ke ESP32

        console.log("✅ Menyimpan angka 31 untuk dikirim ke ESP32");
        await sock.sendMessage(sender, { text: "Mengirim data ke ESP32..." });
      } else {
        await sock.sendMessage(sender, { text: "Perintah tidak tersedia." });
      }
    }
  });

  const app = express();
  app.use(express.json());

  // ESP32 mengambil angka terbaru
  app.get("/command", (req, res) => {
    console.log("📡 ESP32 meminta data...");
    res.json({ number: latestNumber });

    if (latestNumber) {
      console.log("✅ Mengirim angka ke ESP32:", latestNumber);
      latestNumber = ""; // Reset setelah dikirim
    }
  });

  app.listen(3000, () => console.log("🚀 Server berjalan di port 3000"));
}

connectToWhatsApp();
