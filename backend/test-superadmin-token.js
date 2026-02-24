const jwt = require('jsonwebtoken');
require('dotenv').config();
const http = require('http');

const token = jwt.sign(
  { id: '698aa824425aef3f6b729243', role: 'superadmin' },
  process.env.JWT_SECRET || 'pln-iconplus-magang-secret-key-2026',
  { expiresIn: '7d' }
);
console.log("Generated Token:", token);

// Fetch users
http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/users',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Users API Output:', data));
}).end();

// Fetch attendance
http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/attendance?limit=5',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => console.log('Attendance API:', JSON.parse(data).data?.length || JSON.parse(data)));
}).end();
