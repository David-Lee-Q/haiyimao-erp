function pad(n, len = 3) {
  return String(n).padStart(len, '0');
}

function dateStamp(d = new Date()) {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1, 2);
  const day = pad(d.getDate(), 2);
  return `${y}${m}${day}`;
}

function nextSeqCode(db, table, column, prefix) {
  const today = dateStamp();
  const like = `${prefix}-${today}-%`;
  const row = db
    .prepare(`SELECT ${column} AS code FROM ${table} WHERE ${column} LIKE ? ORDER BY ${column} DESC LIMIT 1`)
    .get(like);
  let seq = 1;
  if (row && row.code) {
    seq = parseInt(row.code.split('-').pop(), 10) + 1;
  }
  return `${prefix}-${today}-${pad(seq)}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const d1 = new Date(a + 'T00:00:00Z').getTime();
  const d2 = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((d2 - d1) / 86400000);
}

function round(n, p = 2) {
  const f = Math.pow(10, p);
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
}

module.exports = { pad, dateStamp, nextSeqCode, addDays, daysBetween, round };
