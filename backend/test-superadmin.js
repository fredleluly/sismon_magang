// test-superadmin.js
const http = require('http');

const loginData = JSON.stringify({
  identifier: 'superadmin@plniconplus.co.id',
  password: 'magang123' 
});

const req = http.request({
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
}, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const jsonString = data;
    try {
      const json = JSON.parse(jsonString);
      if (!json.success) {
        console.log('Login failed:', json);
        return;
      }
      const token = json.data.token;
      console.log('Logged in as', json.data.user.role);

    // Fetch users
    http.request({
      hostname: 'localhost',
      port: 5001,
      path: '/api/users',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res2) => {
      let data2 = '';
      res2.on('data', d => data2 += d);
      res2.on('end', () => {
        console.log('Users:', JSON.parse(data2).data?.length || JSON.parse(data2));
      });
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
    }, (res3) => {
      let data3 = '';
      res3.on('data', d => data3 += d);
      res3.on('end', () => {
        console.log('Attendance:', JSON.parse(data3).data?.length || JSON.parse(data3));
      });
    }).end();
    } catch (e) {
      console.error("Failed to parse", jsonString);
    }
  });
});
req.write(loginData);
req.end();
