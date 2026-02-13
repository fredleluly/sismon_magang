// ============================================
// PLN ICON+ Sistem Monitoring Magang - Server
// ============================================

require("dotenv").config();
const express = require("express");
// const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const app = express();

// ===== MIDDLEWARE =====
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // Force handle preflight
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan("dev"));

// Serve frontend static files
// app.use(express.static(path.join(__dirname, '../pln-magang')));

// Serve uploaded files
// Note: Di Vercel serverless, file upload lokal tidak akan tersimpan permanen.
// Gunakan cloud storage seperti Cloudinary untuk produksi.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== ROUTES =====
app.get("/", (req, res) => {
  // const dbStatus = mongoose.connection.readyState;
  // const statusMap = {
  //   0: "Disconnected 🔴",
  //   1: "Connected 🟢",
  //   2: "Connecting 🟡",
  //   3: "Disconnecting 🟠",
  // };

  res.json({
    message: "PLN Magang Monitoring API is running! (NeDB Version)",
    // database_status: statusMap[dbStatus] || "Unknown",
    database_type: "NeDB (Local File System)",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/work-logs", require("./routes/workLogs"));
app.use("/api/attendance", require("./routes/attendance"));
app.use("/api/complaints", require("./routes/complaints"));
app.use("/api/qrcode", require("./routes/qrcode"));
app.use("/api/dashboard", require("./routes/dashboard"));

app.use("/api/target-section", require("./routes/targetSection"));
app.use("/api/seed", require("./routes/seed"));
app.use("/api/performance", require("./routes/performance"));

// Fallback: serve frontend
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../pln-magang/login.html'));
// });

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ===== CONNECT DB & START =====
const PORT = process.env.PORT || 5001;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;
const MONGODB_URI = "nedb://local"; // Placeholder, not used

// Connect to MongoDB
// mongoose
//   .connect(MONGODB_URI)
//   .then(() => {
//     console.log("✅ MongoDB Connected");
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err.message);
//   });
console.log("✅ NeDB Database Initialized (Local)");

// PENTING UNTUK VERCEL:
// Bungkus app.listen agar hanya jalan saat di-run lokal (bukan saat di-import oleh Vercel)
if (require.main === module) {
  // HTTP Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 HTTP  Server: http://localhost:${PORT}`);
    console.log(`📱 Dari Jaringan: http://<LOCAL-IP>:${PORT}`);
    console.log(`📂 Frontend: http://localhost:${PORT}/login.html`);
  });

  // HTTPS Server (Hanya jalan di lokal untuk dev kamera)
  try {
    const https = require("https");
    const fs = require("fs");
    const certPath = path.join(__dirname, "cert");

    if (!fs.existsSync(path.join(certPath, "key.pem"))) {
      // Skiping generation logic for brevity in Vercel context, checking existence only
      // ... (Logika generate cert tetap ada di file asli jika tidak dihapus, tapi di sini kita sederhanakan untuk blok if ini)
    }

    if (fs.existsSync(path.join(certPath, "key.pem"))) {
      const sslOptions = {
        key: fs.readFileSync(path.join(certPath, "key.pem")),
        cert: fs.readFileSync(path.join(certPath, "cert.pem")),
      };

      https.createServer(sslOptions, app).listen(HTTPS_PORT, "0.0.0.0", () => {
        console.log(`🔒 HTTPS Server: https://localhost:${HTTPS_PORT}`);
      });
    }
  } catch (err) {
    console.log("⚠️  HTTPS tidak aktif:", err.message);
  }
}

// Export app untuk Vercel
module.exports = app;
