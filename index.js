const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
} = require("baileys");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

async function connectToWhatsApp(io) {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Connection closed:", lastDisconnect.error);
      io.emit("log", `⚠️ Connection closed: ${lastDisconnect.error}`);

      if (shouldReconnect) {
        connectToWhatsApp(io);
      }
    } else if (connection === "open") {
      console.log("✅ Bot Terhubung ke WhatsApp");
      io.emit("log", "✅ Bot Terhubung ke WhatsApp");
    }
  });

  sock.ev.on("messages.upsert", async (event) => {
    if (event.messages[0].key.fromMe) return;

    for (const m of event.messages) {
      let msgText = m.message?.conversation;
      if (!msgText && m.message?.extendedTextMessage) {
        msgText = m.message.extendedTextMessage.text;
      }

      console.log("📩 Pesan diterima:", msgText);
      io.emit("log", `📩 Pesan diterima: ${msgText}`);

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
            "❌ Perintah tidak tersedia. Ketik /menu untuk daftar perintah.";
      }

      await sock.sendMessage(m.key.remoteJid, { text: response });
      console.log("📤 Pesan dikirim:", response);
      io.emit("log", `📤 Pesan dikirim: ${response}`);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(express.json());

  // Menyimpan log untuk ditampilkan di halaman web
  let logMessages = [];

  io.on("connection", (socket) => {
    console.log("🖥️ Client connected");
    socket.emit("logs", logMessages); // Kirim log lama ke client yang baru terhubung
  });

  const sock = await connectToWhatsApp(io);

  // Endpoint untuk halaman log
  app.get("/", (req, res) => {
    res.send(`
      <html>
      <head>
        <title>WhatsApp Bot Log</title>
        <script src="/socket.io/socket.io.js"></script>
        <script>
          var socket = io();
          socket.on("logs", function(messages) {
            var logContainer = document.getElementById("logs");
            logContainer.innerHTML = "";
            messages.forEach(msg => {
              logContainer.innerHTML += "<p>" + msg + "</p>";
            });
          });

          socket.on("log", function(message) {
            var logContainer = document.getElementById("logs");
            logContainer.innerHTML += "<p>" + message + "</p>";
          });
        </script>
      </head>
      <body>
        <h2>📜 Log WhatsApp Bot</h2>
        <div id="logs" style="border:1px solid #ccc; padding:10px; height:400px; overflow:auto;"></div>
      </body>
      </html>
    `);
  });

  // Jalankan server
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
}

startServer();
