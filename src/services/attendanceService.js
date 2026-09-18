const db = require('../db');
const cardMappingService = require('./cardMappingService');
const ikAdapter = require('../integrations/ikAdapter');
const logger = require('../utils/logger');

// Cihazlarin cogunda ATTLOG satirlari TAB ile ayrilmis su alanlari icerir:
//   UserID  Timestamp  Status  VerifyMode  WorkCode  [ekstra alanlar...]
// Ornek: "42\t2026-09-18 08:02:11\t0\t1\t0"
//
// NOT: ADMS protokolu icin ZKTeco tarafindan yayinlanmis resmi/genel bir
// spesifikasyon yok; alan sirasi ve status kodlarinin anlami firmware'e gore
// kucuk farkliliklar gosterebilir. Asagidaki parse/eslestirme mantigi,
// toplulukca dogrulanmis en yaygin formata gore yazildi - gercek cihazi
// baglayinca /admin/events ile gelen ham kayitlari (rawStatus, verifyMode)
// kontrol edip gerekirse STATUS_DIRECTION_MAP'i cihazinizin davranisina gore
// ayarlayin.
const STATUS_DIRECTION_MAP = {
  0: 'in', // Check-In
  1: 'out', // Check-Out
  2: 'out', // Break-Out
  3: 'in', // Break-In
  4: 'in', // Overtime-In
  5: 'out', // Overtime-Out
};

function parseAttLogBody(body) {
  if (!body) return [];

  return body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split('\t');
      const [deviceUserId, timestamp, rawStatus, verifyMode, workCode] = fields;
      if (!deviceUserId || !timestamp) return null;
      return {
        deviceUserId: deviceUserId.trim(),
        eventTime: normalizeTimestamp(timestamp.trim()),
        rawStatus: (rawStatus ?? '').trim(),
        verifyMode: (verifyMode ?? '').trim(),
        workCode: (workCode ?? '').trim(),
      };
    })
    .filter(Boolean);
}

function normalizeTimestamp(raw) {
  // Cihaz genelde "YYYY-MM-DD HH:mm:ss" gonderir; ISO 8601'e ceviriyoruz.
  // Bazi firmware'ler unix epoch (saniye) gonderebilir, onu da destekleyelim.
  if (/^\d+$/.test(raw)) {
    return new Date(Number(raw) * 1000).toISOString();
  }
  return raw.replace(' ', 'T');
}

/**
 * Cihazdan gelen rawStatus guvenilir degilse (bazi firmware'ler her zaman
 * 0 gonderir), o gun icindeki son olaya bakarak giris/cikisi sirayla
 * (in, out, in, out...) tahmin eden yedek mantik.
 */
function inferDirectionFallback(deviceSn, deviceUserId, eventTime) {
  const dayStart = eventTime.slice(0, 10); // "YYYY-MM-DD"
  const lastEvent = db
    .prepare(
      `SELECT direction FROM attendance_events
       WHERE device_sn = ? AND device_user_id = ? AND event_time LIKE ?
       ORDER BY event_time DESC LIMIT 1`
    )
    .get(deviceSn, deviceUserId, `${dayStart}%`);

  if (!lastEvent) return 'in';
  return lastEvent.direction === 'in' ? 'out' : 'in';
}

function inferDirection(deviceSn, deviceUserId, eventTime, rawStatus) {
  const mapped = STATUS_DIRECTION_MAP[Number(rawStatus)];
  if (mapped) return mapped;
  return inferDirectionFallback(deviceSn, deviceUserId, eventTime);
}

const insertEventStmt = db.prepare(`
  INSERT OR IGNORE INTO attendance_events
    (tenant_id, device_sn, device_user_id, personnel_id, event_time, raw_status, verify_mode, direction)
  VALUES
    (@tenantId, @deviceSn, @deviceUserId, @personnelId, @eventTime, @rawStatus, @verifyMode, @direction)
`);

const markSyncedStmt = db.prepare(
  `UPDATE attendance_events SET synced = 1, sync_error = NULL WHERE id = ?`
);
const markSyncErrorStmt = db.prepare(
  `UPDATE attendance_events SET sync_error = ? WHERE id = ?`
);

/**
 * Tek bir ATTLOG kaydini isler: personel eslestirmesini bulur, veritabanina
 * yazar (duplicate ise sessizce atlar) ve IK entegrasyon adaptorunu tetikler.
 */
async function recordEvent(deviceSn, tenantId, parsed) {
  const direction = inferDirection(deviceSn, parsed.deviceUserId, parsed.eventTime, parsed.rawStatus);
  const mapping = cardMappingService.getMapping(deviceSn, parsed.deviceUserId);

  if (!mapping) {
    logger.warn(
      `Eslesme bulunamadi: device_sn=${deviceSn} device_user_id=${parsed.deviceUserId} - once /admin/mappings ile personel eslestirmesi eklemelisiniz.`
    );
  }

  const info = insertEventStmt.run({
    tenantId,
    deviceSn,
    deviceUserId: parsed.deviceUserId,
    personnelId: mapping ? mapping.personnel_id : null,
    eventTime: parsed.eventTime,
    rawStatus: parsed.rawStatus,
    verifyMode: parsed.verifyMode,
    direction,
  });

  // INSERT OR IGNORE ile cakisan (ayni cihaz+kullanici+zaman+status) kayit
  // zaten varsa lastInsertRowid degismez / changes=0 olur; tekrar isleme.
  if (info.changes === 0) {
    return null;
  }

  const event = {
    id: info.lastInsertRowid,
    tenantId,
    deviceSn,
    deviceUserId: parsed.deviceUserId,
    personnelId: mapping ? mapping.personnel_id : null,
    personnelName: mapping ? mapping.personnel_name : null,
    eventTime: parsed.eventTime,
    direction,
    rawStatus: parsed.rawStatus,
    verifyMode: parsed.verifyMode,
  };

  try {
    await ikAdapter.handleAttendanceEvent(event);
    markSyncedStmt.run(event.id);
  } catch (err) {
    logger.error(`ikAdapter.handleAttendanceEvent hata verdi (event id=${event.id}):`, err.message);
    markSyncErrorStmt.run(err.message, event.id);
  }

  return event;
}

function listEvents({ tenantId, deviceSn, limit = 100 } = {}) {
  let query = 'SELECT * FROM attendance_events WHERE 1=1';
  const params = [];
  if (tenantId) {
    query += ' AND tenant_id = ?';
    params.push(tenantId);
  }
  if (deviceSn) {
    query += ' AND device_sn = ?';
    params.push(deviceSn);
  }
  query += ' ORDER BY event_time DESC LIMIT ?';
  params.push(Number(limit) || 100);
  return db.prepare(query).all(...params);
}

module.exports = { parseAttLogBody, recordEvent, listEvents, inferDirection };
