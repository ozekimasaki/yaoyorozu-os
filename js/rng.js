export function hash32(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jstDateKey(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const jst = new Date(utc + 9 * 60 * 60000);
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, "0");
  const d = String(jst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hexFromHash(n, width = 8) {
  return (n >>> 0).toString(16).padStart(width, "0");
}

export function pick(rng, list) {
  if (!list.length) return null;
  return list[(rng() * list.length) | 0];
}

export function pickN(rng, list, n) {
  const copy = list.slice();
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice((rng() * copy.length) | 0, 1)[0]);
  }
  return out;
}

export function bits16(n) {
  return (n >>> 0).toString(2).padStart(16, "0");
}
