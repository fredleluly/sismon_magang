require('dotenv').config();
const mongoose = require('mongoose');

console.log('Connecting to:', process.env.MONGODB_URI);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ Connection Error:', err.message);
    process.exit(1);
  });
        