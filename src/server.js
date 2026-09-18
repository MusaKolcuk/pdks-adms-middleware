const express = require('express');
const config = require('./config');
const logger = require('./utils/logger');
const admsRoutes = require('./routes/adms');
const adminRoutes = require('./routes/admin');

const app = express();

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Kart okuyucu cihazlarin konustugu ADMS/Push protokolu endpoint'leri.
// Cihazin "sunucu adresi" ayarina bu servisin adresini + /iclock on ekini
// yazmaniz gerekir (bkz. README).
app.use('/iclock', admsRoutes);

// Cihaz/personel eslestirme ve test amacli yonetim API'si (x-api-key ile korumali).
app.use('/admin', adminRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  logger.error('Beklenmeyen hata:', err);
  res.status(500).type('text/plain').send('Internal error');
});

app.listen(config.port, () => {
  logger.info(`PDKS ADMS ara servisi ${config.port} portunda calisiyor`);
});
