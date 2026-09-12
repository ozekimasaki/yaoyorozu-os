export function extOf(path) {
  const base = String(path || "")
    .split("/")
    .pop() || "";
  const i = base.lastIndexOf(".");
  if (i <= 0) return "";
  return base.slice(i).toLowerCase();
}

export function defaultAssoc() {
  return [
    { match: ".gate", app: "gate" },
    { match: "gate/app", app: "gate" },
    { match: "inode/directory", app: "fs" },
    { match: "inode/symlink", app: "fs" },
    { match: "text/yaoyorozu", app: "editor" },
    { match: "text/proc", app: "editor" },
    { match: "text/calendar", app: "cal" },
    { match: "text/plain", app: "editor" },
    { match: ".yaoyorozu", app: "editor" },
    { match: ".ofuda", app: "editor" },
    { match: ".txt", app: "editor" },
    { match: ".stack", app: "editor" },
    { match: ".2100", app: "editor" },
    { match: ".sched", app: "cal" },
    { match: ".name", app: "muen" },
    { match: ".proc", app: "editor" },
  ];
}

export function parseAssoc(text) {
  const rows = [];
  for (const line of String(text || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/);
    if (parts[0] && parts[1]) rows.push({ match: parts[0], app: parts[1] });
  }
  return rows;
}

export function assocText(rows) {
  const body = (rows || defaultAssoc()).map((r) => `${r.match} ${r.app}`).join("\n");
  return `# match app\n${body}\n`;
}

export function resolveOpen(path, file, table) {
  const n = (file && file.path) || path || "";
  const mime = (file && file.mime) || "";
  const type = file && file.type;
  if (type === "dir") return { app: "fs", why: "dir" };
  const ext = extOf(n);
  for (const row of table || defaultAssoc()) {
    if (row.match === n || row.match === mime || (ext && row.match === ext)) {
      return { app: row.app, why: row.match };
    }
  }
  if (n.startsWith("/proc/") || mime === "text/proc") return { app: "editor", why: "proc" };
  if (type === "link") return { app: "fs", why: "link" };
  return { app: "fs", why: "default" };
}

export function handlersFor(path, file, table, appIds) {
  const primary = resolveOpen(path, file, table);
  const extra = ["editor", "fs", "term", "clip"];
  const seen = new Set();
  const out = [];
  for (const id of [primary.app, ...extra]) {
    if (!id || id === "gate" || seen.has(id)) continue;
    if (appIds && !appIds.has(id)) continue;
    seen.add(id);
    out.push({ id, primary: id === primary.app });
  }
  return out;
}
