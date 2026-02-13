const db = require('./backend/db');

async function testDB() {
  console.log('Testing DB...');
  try {
    const doc = await db.users.insert({ test: true });
    console.log('Insert success:', doc);
    const found = await db.users.findOne({ _id: doc._id });
    console.log('Find success:', found);
    await db.users.remove({ _id: doc._id }, {});
    console.log('Remove success');
  } catch (err) {
    console.error('DB Error:', err);
  }
}

testDB();
