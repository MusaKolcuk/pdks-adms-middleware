const db = require('../db');

function getMapping(deviceSn, deviceUserId) {
  return db
    .prepare('SELECT * FROM card_mappings WHERE device_sn = ? AND device_user_id = ?')
    .get(deviceSn, deviceUserId);
}

function listByDevice(deviceSn) {
  return db
    .prepare('SELECT * FROM card_mappings WHERE device_sn = ? ORDER BY personnel_name')
    .all(deviceSn);
}

function upsert({ tenantId, deviceSn, deviceUserId, personnelId, personnelName }) {
  db.prepare(`
    INSERT INTO card_mappings (tenant_id, device_sn, device_user_id, personnel_id, personnel_name)
    VALUES (@tenantId, @deviceSn, @deviceUserId, @personnelId, @personnelName)
    ON CONFLICT(device_sn, device_user_id) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      personnel_id = excluded.personnel_id,
      personnel_name = excluded.personnel_name
  `).run({ tenantId, deviceSn, deviceUserId, personnelId, personnelName: personnelName || null });
  return getMapping(deviceSn, deviceUserId);
}

module.exports = { getMapping, listByDevice, upsert };
