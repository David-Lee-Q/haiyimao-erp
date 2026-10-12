const path = require('path');

module.exports = {
  port: process.env.PORT || 3001,
  jwtSecret: process.env.JWT_SECRET || 'fresh-trade-erp-secret-dev',
  jwtExpiresIn: '12h',
  dbFile: process.env.DB_FILE || path.join(__dirname, '..', 'data', 'erp.db'),
};
