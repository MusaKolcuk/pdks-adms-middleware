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

// Basit CORS: test/izleme araci gibi taraycidan (baska bir origin'den) bu
// API'ye istek atabilmek icin. Cihazlarin kendisi tarayici olmadigi icin
// bundan etkilenmiyor; sadece kendi test arayuzumuz gibi web sayfalarinin
// bu API'yi cagirabilmesini sagliyor.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
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
