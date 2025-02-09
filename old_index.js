const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("baileys");
const express = require("express");

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    // can provide additional config here
    auth: state,
    printQRInTerminal: true,
  });
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(
        "connection closed due to ",
        lastDisconnect.error,
        ", reconnecting ",
        shouldReconnect
      );
      // reconnect if not logged out
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === "open") {
      console.log("opened connection");
    }
  });

  sock.ev.on("messages.upsert", async (event) => {
    // Lewati pesan yang dikirim oleh bot sendiri
    if (event.messages[0].key.fromMe) return;

    for (const m of event.messages) {
      // Ekstrak teks pesan. Struktur pesan bisa bervariasi, jadi pastikan disesuaikan jika perlu.
      let msgText = m.message?.conversation;
      if (!msgText && m.message?.extendedTextMessage) {
        msgText = m.message.extendedTextMessage.text;
      }

      console.log("Pesan diterima:", msgText);
      console.log("Replying to", m.key.remoteJid);

      // Menentukan respon berdasarkan isi pesan
      let response = "";
      switch (msgText) {
        case "/menu":
          response = "Silahkan pilih Menu";
          break;
        case "/botaktif":
          response = "bot sudah aktif";
          break;
        default:
          response =
            "Perintah anda tidak tersedia. Silakan ketik /menu untuk daftar perintah.";
      }

      // Mengirimkan pesan balasan
      await sock.sendMessage(m.key.remoteJid, { text: response });
    }
  });
  // to storage creds (session info) when it updates
  sock.ev.on("creds.update", saveCreds);

  return sock;
}
// run in main file
async function startServer() {
  const sock = await connectToWhatsApp();

  // Membuat Express app
  const app = express();
  app.use(express.json());

  // Endpoint yang akan diakses ESP32 ketika sensor mendeteksi api
  // Pastikan ESP32 mengirimkan POST request ke endpoint ini dengan data JSON
  app.post("/alert", async (req, res) => {
    // Misal, ESP32 mengirimkan data: { "remoteJid": "nomor_whatsapp_tujuan", "alertMessage": "Api terdeteksi!" }
    const { remoteJid, alertMessage } = req.body;
    if (!remoteJid || !alertMessage) {
      return res
        .status(400)
        .json({ error: "remoteJid dan alertMessage harus diisi" });
    }
    try {
      await sock.sendMessage(remoteJid, { text: alertMessage });
      res.status(200).json({ status: "Pesan terkirim" });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ error: "Gagal mengirim pesan" });
    }
  });

  // Jalankan server di port tertentu, misalnya 3000
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`Server berjalan di port ${PORT}`));

  let latestCommand = ""; // Menyimpan perintah terbaru

  // Endpoint untuk menerima perintah dari pengguna WA
  app.post("/receive-command", (req, res) => {
    const { command, sender } = req.body;
    if (!command || !sender) {
      return res.status(400).json({ error: "Command dan sender harus diisi" });
    }

    latestCommand = command; // Simpan perintah untuk ESP32
    res.status(200).json({ status: "Command diterima" });
  });

  // Endpoint yang diakses ESP32 untuk mengambil perintah
  app.get("/command", (req, res) => {
    res.status(200).send(latestCommand);
    latestCommand = ""; // Hapus perintah setelah dikirim ke ESP32
  });

  // Endpoint yang diakses ESP32 untuk mengirim respons
  app.post("/send-message", async (req, res) => {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Pesan harus diisi" });
    }

    if (latestSender) {
      await sock.sendMessage(latestSender, { text: message }); // Kirim pesan ke pengirim perintah
    }

    res.status(200).json({ status: "Pesan dikirim ke pengguna" });
  });
}

startServer();
