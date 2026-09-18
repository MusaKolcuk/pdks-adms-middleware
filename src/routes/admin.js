const express = require('express');
const config = require('../config');
const deviceService = require('../services/deviceService');
const cardMappingService = require('../services/cardMappingService');
const attendanceService = require('../services/attendanceService');

const router = express.Router();

// Bu router'daki her endpoint, header'da dogru API anahtarini ister.
// curl ornegi: curl -H "x-api-key: <ADMIN_API_KEY>" ...
router.use(express.json());
router.use((req, res, next) => {
  const key = req.header('x-api-key');
  if (!key || key !== config.adminApiKey) {
    return res.status(401).json({ error: 'Gecersiz veya eksik x-api-key' });
  }
  next();
});

// --- Cihazlar ---
// Yeni bir kart okuyucu/firma eklerken ilk yapmaniz gereken budur:
// cihazin seri numarasini hangi firmaya (tenantId) ait oldugunu kaydedin.
router.get('/devices', (req, res) => {
  res.json(deviceService.list());
});

router.post('/devices', (req, res) => {
  const { sn, tenantId, name, active } = req.body;
  if (!sn || !tenantId) {
    return res.status(400).json({ error: 'sn ve tenantId zorunlu' });
  }
  res.json(deviceService.upsert({ sn, tenantId, name, active }));
});

// --- Kart / personel eslestirmeleri ---
// Cihaza bir kart/parmak izi kaydedilirken verilen "kullanici ID"sini
// (device_user_id) sizin sistemdeki personelId'ye baglar.
router.get('/mappings', (req, res) => {
  const { deviceSn } = req.query;
  if (!deviceSn) {
    return res.status(400).json({ error: 'deviceSn query parametresi zorunlu' });
  }
  res.json(cardMappingService.listByDevice(deviceSn));
});

router.post('/mappings', (req, res) => {
  const { tenantId, deviceSn, deviceUserId, personnelId, personnelName } = req.body;
  if (!tenantId || !deviceSn || !deviceUserId || !personnelId) {
    return res.status(400).json({ error: 'tenantId, deviceSn, deviceUserId, personnelId zorunlu' });
  }
  res.json(cardMappingService.upsert({ tenantId, deviceSn, deviceUserId, personnelId, personnelName }));
});

// --- Olaylar (test/hata ayiklama icin) ---
// IK entegrasyonunu baglamadan once cihazdan veri gelip gelmedigini,
// dogru personelle eslesip eslesmedigini buradan kontrol edebilirsiniz.
router.get('/events', (req, res) => {
  const { tenantId, deviceSn, limit } = req.query;
  res.json(attendanceService.listEvents({ tenantId, deviceSn, limit }));
});

module.exports = router;
