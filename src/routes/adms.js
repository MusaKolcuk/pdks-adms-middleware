const express = require('express');
const deviceService = require('../services/deviceService');
const attendanceService = require('../services/attendanceService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * ADMS / Push protokolu (ZKTeco ve turevi cihazlarin buyuk cogunlugu):
 *
 *  GET  /iclock/cdata?SN=...&options=all           -> cihaz acilista "ben buradayim,
 *                                                       ayarlarini ver" der (handshake)
 *  POST /iclock/cdata?SN=...&table=ATTLOG           -> cihaz giris-cikis (kart/parmak izi)
 *                                                       kayitlarini gonderir
 *  POST /iclock/cdata?SN=...&table=OPERLOG          -> cihaz uzerinde yapilan islem
 *                                                       loglari (kullanici ekleme vb.)
 *  GET  /iclock/getrequest?SN=...                   -> cihaz "bana bekleyen komut var mi"
 *                                                       diye sorar (polling)
 *  POST /iclock/devicecmd?SN=...                    -> cihaz gonderdigimiz bir komutun
 *                                                       sonucunu bildirir
 *
 * ONEMLI: Bu, resmi olarak yayinlanmis bir spesifikasyona degil, ZKTeco ve
 * benzeri cihazlarda yaygin gozlemlenen davranisa dayanir. Gercek cihazla
 * ilk testte /admin/events uzerinden gelen ham kayitlari mutlaka kontrol
 * edin; firmware'e gore kucuk formil farkliliklari olabilir.
 */

function requireKnownDevice(req, res, next) {
  const sn = req.query.SN;
  if (!sn) {
    return res.status(400).send('SN parametresi eksik');
  }

  const device = deviceService.getBySn(sn);
  if (!device || !device.active) {
    // Bilinmeyen/pasif bir cihazdan veri kabul etmiyoruz. Yeni bir cihaz
    // kurulumu yapiyorsaniz once POST /admin/devices ile kaydedin.
    logger.warn(`Bilinmeyen/pasif cihazdan istek: SN=${sn} (once /admin/devices ile kaydedin)`);
    return res.status(403).send('Unknown device');
  }

  req.device = device;
  next();
}

// --- Handshake / kayit ---
router.get('/cdata', requireKnownDevice, (req, res) => {
  logger.info(`Handshake: SN=${req.device.sn} query=${JSON.stringify(req.query)}`);

  // Cihaza cevap olarak calisma parametrelerini donuyoruz. Degerler cogu
  // cihaz icin makul varsayilanlar; ihtiyaca gore ayarlanabilir.
  const lines = [
    `GET OPTION FROM: ${req.device.sn}`,
    'Stamp=9999',
    'OpStamp=9999',
    'PhotoStamp=9999',
    'ErrorDelay=30',
    'Delay=10',
    'TransTimes=00:00;12:00',
    'TransInterval=1',
    'TransFlag=1111000000',
    'Realtime=1',
    'Encrypt=None',
  ];
  res.type('text/plain').send(lines.join('\n'));
});

// --- Veri gonderimi: ATTLOG / OPERLOG ---
router.post('/cdata', requireKnownDevice, express.text({ type: '*/*', limit: '5mb' }), async (req, res) => {
  const { table } = req.query;
  const body = req.body || '';

  if (table === 'ATTLOG') {
    const records = attendanceService.parseAttLogBody(body);
    logger.info(`ATTLOG: SN=${req.device.sn} kayit sayisi=${records.length}`);

    for (const record of records) {
      await attendanceService.recordEvent(req.device.sn, req.device.tenant_id, record);
    }

    // Cihaz, kac kaydi kabul ettigimizi belirten bu formati bekler.
    return res.type('text/plain').send(`OK: ${records.length}`);
  }

  if (table === 'OPERLOG') {
    // Kullanici ekleme/silme gibi cihaz-ici islem loglari. Su an sadece
    // logluyoruz; ihtiyaciniz olursa buraya kendi isleminizi ekleyebilirsiniz.
    logger.info(`OPERLOG: SN=${req.device.sn} (${body.split('\n').filter(Boolean).length} satir) - islenmedi`);
    return res.type('text/plain').send('OK');
  }

  // table parametresi olmadan da (ornegin cihaz bilgisi) POST atan
  // cihazlar olabiliyor; reddetmek yerine kabul edip logluyoruz.
  logger.info(`cdata POST (table yok/bilinmiyor): SN=${req.device.sn} query=${JSON.stringify(req.query)}`);
  res.type('text/plain').send('OK');
});

// --- Komut kuyrugu (kullanmiyorsak da cihaz bu endpoint'i cagirir) ---
router.get('/getrequest', requireKnownDevice, (req, res) => {
  // Bekleyen komutumuz yok; cihaza "OK" diyoruz.
  res.type('text/plain').send('OK');
});

router.post('/devicecmd', requireKnownDevice, express.text({ type: '*/*' }), (req, res) => {
  logger.info(`devicecmd sonucu: SN=${req.device.sn} body=${req.body}`);
  res.type('text/plain').send('OK');
});

// --- Bazi cihazlar ek olarak registry endpoint'ini de cagirir ---
router.all('/registry', requireKnownDevice, express.text({ type: '*/*' }), (req, res) => {
  logger.info(`registry: SN=${req.device.sn}`);
  res.type('text/plain').send('OK');
});

module.exports = router;
