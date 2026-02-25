const mongoose = require('mongoose');
const User = require('./models/User');
mongoose.connect('mongodb://localhost:27017/sismon_magang');
User.findOne({ username: 'mrf' }).then(user => {
  console.log(user);
  process.exit(0);
});
