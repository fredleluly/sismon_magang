const Datastore = require('nedb-promises');
const path = require('path');

const dbFactory = (fileName) => Datastore.create({
  filename: path.join(__dirname, '..', 'data', fileName),
  autoload: true,
  timestampData: true
});

const db = {
  users: dbFactory('users.db'),
  workLogs: dbFactory('workLogs.db'),
  attendance: dbFactory('attendance.db'),
  complaints: dbFactory('complaints.db'),
  qrcode: dbFactory('qrcode.db'),
  targetSection: dbFactory('targetSection.db'),
  performance: dbFactory('performance.db')
};

module.exports = db;
