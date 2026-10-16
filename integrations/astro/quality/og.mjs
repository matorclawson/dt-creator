// Pure artifact checks. Callers supply decoded observations and all publication policy.
const sha = /^[a-f0-9]{64}$/;
const isHash = value => typeof value === 'string' && sha.test(value);
export function auditOgArtifacts(expected, observed, policy) {
  if (!Array.isArray(expected) || !Array.isArray(observed) ||
      !Array.isArray(policy?.origins) || !policy.origins.length ||
      !Array.isArray(policy.formats) || !policy.formats.length ||
      !policy.formats.every(format => typeof format === 'string' && format.trim()) ||
      ![policy.width, policy.height, policy.maxBytes].every(n => Number.isSafeInteger(n) && n > 0) ||
      typeof policy.uniquePixels !== 'boolean') throw new TypeError('Explicit inventory and complete policy required');
  for (const origin of policy.origins) {
    const u = new URL(origin);
    if (u.protocol !== 'https:' || u.origin !== origin) throw new TypeError('HTTPS origins required');
  }
  const findings = [];
  const add = (code, url) => findings.push({code, url});
  const targets = new Map();
  for (const row of expected) {
    if (!row || typeof row.url !== 'string' || !isHash(row.sha256)) throw new TypeError('Expected URL and SHA256 required');
    let u;
    try { u = new URL(row.url); } catch { /* reported below */ }
    if (!u || u.protocol !== 'https:' || !policy.origins.includes(u.origin) || u.username || u.password || row.url.includes('#') || row.url.includes('?')) add('invalid-url', row.url);
    if (targets.has(row.url)) add('duplicate-target', row.url);
    targets.set(row.url, row);
  }
  const seen = new Set(), pixels = new Set();
  for (const row of observed) {
    if (!row || typeof row.url !== 'string') throw new TypeError('Observed URL required');
    if (seen.has(row.url)) add('duplicate-observation', row.url);
    seen.add(row.url);
    const target = targets.get(row.url);
    if (!target) { add('unexpected-artifact', row.url); continue; }
    if (row.sha256 !== target.sha256) add('hash-mismatch', row.url);
    if (row.decoded !== true || !isHash(row.pixelSha256)) add('decode-failed', row.url);
    if (!policy.formats.includes(row.format)) add('wrong-format', row.url);
    if (row.width !== policy.width || row.height !== policy.height) add('wrong-dimensions', row.url);
    if (!Number.isSafeInteger(row.bytes) || row.bytes <= 0 || row.bytes > policy.maxBytes) add('byte-budget', row.url);
    if (policy.uniquePixels && isHash(row.pixelSha256)) {
      if (pixels.has(row.pixelSha256)) add('duplicate-pixels', row.url);
      pixels.add(row.pixelSha256);
    }
  }
  for (const url of targets.keys()) if (!seen.has(url)) add('missing-artifact', url);
  return findings;
}
