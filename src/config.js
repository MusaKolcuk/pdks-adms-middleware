require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 8080,
  adminApiKey: process.env.ADMIN_API_KEY || 'degistir-bu-anahtari',
  dbPath: process.env.DB_PATH || './data/pdks.sqlite',
};
