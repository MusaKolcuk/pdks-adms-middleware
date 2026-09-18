const db = require('../db');

function getBySn(sn) {
  return db.prepare('SELECT * FROM devices WHERE sn = ?').get(sn);
}

function list() {
  return db.prepare('SELECT * FROM devices ORDER BY created_at DESC').all();
}

function upsert({ sn, tenantId, name, active = 1 }) {
  db.prepare(`
    INSERT INTO devices (sn, tenant_id, name, active)
    VALUES (@sn, @tenantId, @name, @active)
    ON CONFLICT(sn) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      name = excluded.name,
      active = excluded.active
  `).run({ sn, tenantId, name: name || null, active: active ? 1 : 0 });
  return getBySn(sn);
}

module.exports = { getBySn, list, upsert };
