const db = require('./db');
module.exports = { getDb: db.getDb, saveDb: db.saveDb, genId: db.genId };
