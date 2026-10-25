// Date and time utilities in Indian Standard Time (IST, UTC+5:30)

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

export function getIstDate(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

export function dayKey(d = new Date()) {
  const ist = getIstDate(d);
  return ist.toISOString().slice(0, 10);
}

export function dayStart(d = new Date()) {
  const ist = getIstDate(d);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - IST_OFFSET_MS);
}

export function daysBetween(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return Infinity;
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
