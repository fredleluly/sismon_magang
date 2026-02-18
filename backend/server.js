// ============================================
// PLN ICON+ Sistem Monitoring Magang - Server
// ============================================

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");

const app = express();

// ===== DB CONNECTION (CACHED FOR VERCEL) =====
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://breaklimited12_db_user:00FMxh3cSnXf3CQ7@ac-9wljaxr-shard-00-00.ha9nmsu.mongodb.net:27017,ac-9wljaxr-shard-00-01.ha9nmsu.mongodb.net:27017,ac-9wljaxr-shard-00-02.ha9nmsu.mongodb.net:27017/pln_magang_monitoring?ssl=true&replicaSet=atlas-7ro3bk-shard-0&authSource=admin&retryWrites=true&w=majority&appName=cluster-magang";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Disable Mongoose buffering
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log("✅ MongoDB New Connection Established");
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

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

// Ensure DB is connected before handling requests
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
    } catch (err) {
      console.error("❌ MongoDB connection failed in middleware:", err.message);
    }
  }
  next();
});

// Serve uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== ROUTES =====
app.get("/", async (req, res) => {
  let dbStatus = mongoose.connection.readyState;
  
  // Try to reconnect if disconnected
  if (dbStatus !== 1) {
    try {
        await connectDB();
        dbStatus = mongoose.connection.readyState;
    } catch (e) {
        console.error("Reconnection failed:", e);
    }
  }

  const statusMap = {
    0: "Disconnected 🔴",
    1: "Connected 🟢",
    2: "Connecting 🟡",
    3: "Disconnecting 🟠",
  };

  res.json({
    message: "PLN Magang Monitoring API is running!",
    database_status: statusMap[dbStatus] || "Unknown",
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
app.use("/api/seed", require("./routes/seed"));
app.use("/api/target-section", require("./routes/targetSection"));
app.use("/api/performance", require("./routes/performance"));

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

// Connect DB (Initial)
connectDB().catch(err => console.error(err));

if (require.main === module) {
  // HTTP Server
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 HTTP  Server: http://localhost:${PORT}`);
    console.log(`📱 Dari Jaringan: http://<LOCAL-IP>:${PORT}`);
    console.log(`📂 Frontend: http://localhost:${PORT}/login.html`);
  });

  // HTTPS Server (Local Only)
  try {
    const https = require("https");
    const fs = require("fs");
    const certPath = path.join(__dirname, "cert");

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
    console.log("⚠️  HTTPS not active:", err.message);
  }
}

module.exports = app;

