// ============================================
// PLN ICON+ Sistem Monitoring Magang - Server
// ============================================

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const app = express();

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../pln-magang')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ROUTES =====
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/work-logs', require('./routes/workLogs'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/qrcode', require('./routes/qrcode'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Fallback: serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../pln-magang/login.html'));
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ===== CONNECT DB & START =====
const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://breaklimited12_db_user:00FMxh3cSnXf3CQ7@ac-9wljaxr-shard-00-00.ha9nmsu.mongodb.net:27017,ac-9wljaxr-shard-00-01.ha9nmsu.mongodb.net:27017,ac-9wljaxr-shard-00-02.ha9nmsu.mongodb.net:27017/pln_magang_monitoring?ssl=true&replicaSet=atlas-7ro3bk-shard-0&authSource=admin&retryWrites=true&w=majority&appName=cluster-magang';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');

    // HTTP Server - listening di semua interface untuk network access
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 HTTP  Server: http://localhost:${PORT}`);
      console.log(`📱 Dari Jaringan: http://<LOCAL-IP>:${PORT}`);
      console.log(`📂 Frontend: http://localhost:${PORT}/login.html`);
    });

    // HTTPS Server (for camera access from other devices)
    try {
      const https = require('https');
      const fs = require('fs');
      const certPath = path.join(__dirname, 'cert');

      if (!fs.existsSync(path.join(certPath, 'key.pem'))) {
        fs.mkdirSync(certPath, { recursive: true });
        let generated = false;

        // Try openssl first
        try {
          const { execSync } = require('child_process');
          execSync(`openssl req -x509 -newkey rsa:2048 -keyout "${path.join(certPath, 'key.pem')}" -out "${path.join(certPath, 'cert.pem')}" -days 365 -nodes -subj "/CN=localhost"`, { stdio: 'pipe' });
          generated = true;
        } catch (e) {
          // openssl not available, try selfsigned package
          try {
            const selfsigned = require('selfsigned');
            const attrs = [{ name: 'commonName', value: 'localhost' }];
            const pems = selfsigned.generate(attrs, { days: 365 });
            fs.writeFileSync(path.join(certPath, 'key.pem'), pems.private);
            fs.writeFileSync(path.join(certPath, 'cert.pem'), pems.cert);
            generated = true;
          } catch (e2) {
            console.log('⚠️  Install selfsigned untuk HTTPS: npm install selfsigned');
          }
        }
        if (generated) console.log('🔐 Self-signed certificate generated di folder cert/');
      }

      if (fs.existsSync(path.join(certPath, 'key.pem'))) {
        const sslOptions = {
          key: fs.readFileSync(path.join(certPath, 'key.pem')),
          cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
        };

        https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
          console.log(`🔒 HTTPS Server: https://localhost:${HTTPS_PORT}`);
          console.log(`📱 Dari HP (satu WiFi): https://<IP-komputer>:${HTTPS_PORT}/login.html`);
        });
      } else {
        console.log('⚠️  HTTPS tidak aktif. Gunakan ngrok atau localhost untuk kamera.');
      }
    } catch (err) {
      console.log('⚠️  HTTPS tidak aktif:', err.message);
    }
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
