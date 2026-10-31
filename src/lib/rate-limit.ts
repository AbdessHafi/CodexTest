const buckets = new Map<string, { count: number; until: number }>();
// Instance-local guard. Use shared Redis before multi-instance production deployment.
export function allow(key: string, now = Date.now()) {
  for (const [k, v] of buckets) if (v.until <= now) buckets.delete(k);
  const b = buckets.get(key);
  if (b && b.count >= 5) return false;
  if (b) b.count++;
  else {
    if (buckets.size >= 10000) return false;
    buckets.set(key, { count: 1, until: now + 15 * 60 * 1000 });
  }
  return true;
}
