const express = require("express");
const app = express();
const port = 3000;

// Middleware untuk parsing JSON
app.use(express.json());

// Menyajikan file HTML secara statis dari folder "public"
app.use(express.static(__dirname + "/public"));

// Variabel status api
let fireDetected = false;

// Endpoint untuk mendapatkan status api
app.get("/fire-status", (req, res) => {
  res.json({
    status: fireDetected ? "🔥 Api Terdeteksi!" : "✅ Tidak Ada Api",
    class: fireDetected ? "text-danger fw-bold" : "text-success fw-bold",
  });
});

// Endpoint untuk mengubah status api
app.post("/set-fire", (req, res) => {
  if (typeof req.body.status === "boolean") {
    fireDetected = req.body.status;
    res.json({ message: "Status api diperbarui." });
  } else {
    res.status(400).json({
      error: "Status tidak valid. Harus berupa boolean (true/false).",
    });
  }
});

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://172.22.2.71:${port}`);
});
