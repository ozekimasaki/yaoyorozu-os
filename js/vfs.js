const DB_NAME = "yaoyorozu-vfs";
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files", { keyPath: "path" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
}

function normalize(path) {
  if (!path || path === "/") return "/";
  const parts = String(path)
    .split("/")
    .filter((p) => p && p !== ".");
  const stack = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return `/${stack.join("/")}`;
}

function parentOf(path) {
  const n = normalize(path);
  if (n === "/") return "/";
  return n.slice(0, n.lastIndexOf("/")) || "/";
}

function nameOf(path) {
  const n = normalize(path);
  if (n === "/") return "/";
  return n.slice(n.lastIndexOf("/") + 1);
}

export function createVfs() {
  let db = null;
  let indexReady = false;
  const cache = new Map();
  const children = new Map();
  const findMemo = new Map();
  const grepMemo = new Map();
  const watchers = new Set();
  const MEMO_CAP = 24;
  const rootUsage = { bytes: 0, files: 0, dirs: 0, dirty: true };
  let quotaBytes = 0;
  let quotaSweep = null;
  let quotaBusy = false;

  function watch(fn) {
    if (typeof fn !== "function") return () => {};
    watchers.add(fn);
    return () => watchers.delete(fn);
  }

  function notify(path, op) {
    for (const fn of watchers) {
      try {
        fn(path, op);
      } catch (err) {
        /* watcher */
      }
    }
  }

  function bustSearch() {
    findMemo.clear();
    grepMemo.clear();
  }

  const mounts = new Map();

  function addMount(root, ops) {
    const r = normalize(root);
    if (r === "/" || !ops) throw new Error("EPERM");
    mounts.set(r, { root: r, ops });
    bustSearch();
    notify(r, "mount");
  }

  function dropMount(root) {
    const r = normalize(root);
    mounts.delete(r);
    bustSearch();
    notify(r, "unmount");
  }

  function mountOf(path) {
    const p = normalize(path);
    let best = "";
    let hit = null;
    for (const [root, m] of mounts) {
      if (p === root || p.startsWith(`${root}/`)) {
        if (root.length > best.length) {
          best = root;
          hit = m;
        }
      }
    }
    return hit;
  }

  function relOf(path, root) {
    const p = normalize(path);
    const r = normalize(root);
    if (p === r) return "";
    return p.slice(r.length + 1);
  }

  function listMounts() {
    return [...mounts.keys()];
  }

  function mergeMountKids(dir, rows) {
    const n = normalize(dir);
    const have = new Set(rows.map((r) => r.path));
    for (const [root] of mounts) {
      if (parentOf(root) !== n || have.has(root)) continue;
      rows.push({
        path: root,
        name: nameOf(root),
        type: "dir",
        mime: "inode/directory",
        body: "",
        updated: Date.now(),
        mount: true,
      });
      have.add(root);
    }
    return rows;
  }

  async function gatherMountSearch(n, fn) {
    if (n === "/") return [];
    const extra = [];
    for (const [root, m] of mounts) {
      if (root !== n && !root.startsWith(`${n}/`)) continue;
      const part = await fn(m, root);
      if (part && part.length) extra.push(...part);
    }
    return extra;
  }

  function memoGet(map, key) {
    const hit = map.get(key);
    if (!hit) return null;
    map.delete(key);
    map.set(key, hit);
    return hit;
  }

  function memoSet(map, key, val) {
    if (map.has(key)) map.delete(key);
    map.set(key, val);
    if (map.size > MEMO_CAP) map.delete(map.keys().next().value);
  }

  function underRoot(path, root) {
    if (root === "/") return true;
    return path === root || path.startsWith(`${root}/`);
  }

  function applyUsage(rec, sign) {
    if (!rec || rec.path === "/") return;
    if (rec.type === "dir") rootUsage.dirs += sign;
    else {
      rootUsage.files += sign;
      rootUsage.bytes += sign * String(rec.body || "").length;
    }
  }

  function recountRoot() {
    let bytes = 0;
    let files = 0;
    let dirs = 0;
    for (const [p, f] of cache) {
      if (p === "/") continue;
      if (f.type === "dir") dirs += 1;
      else {
        files += 1;
        bytes += String(f.body || "").length;
      }
    }
    rootUsage.bytes = bytes;
    rootUsage.files = files;
    rootUsage.dirs = dirs;
    rootUsage.dirty = false;
  }

  function remember(record) {
    const old = cache.get(record.path);
    if (indexReady && !rootUsage.dirty) {
      if (old) applyUsage(old, -1);
      applyUsage(record, 1);
    }
    cache.set(record.path, record);
    if (indexReady) {
      bustSearch();
      notify(record.path, "put");
    }
    if (record.path === "/") return;
    const p = parentOf(record.path);
    if (!children.has(p)) children.set(p, new Set());
    children.get(p).add(record.path);
  }

  function forget(path) {
    const n = normalize(path);
    const old = cache.get(n);
    if (indexReady && !rootUsage.dirty && old) applyUsage(old, -1);
    cache.delete(n);
    const p = parentOf(n);
    const set = children.get(p);
    if (set) set.delete(n);
    bustSearch();
    notify(n, "rm");
  }

  async function ready() {
    if (!db) db = await openDb();
    return db;
  }

  async function getFile(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    if (mounted) {
      try {
        return await mounted.ops.getFile(relOf(n, mounted.root), n);
      } catch (err) {
        if (err && err.message === "ENOENT") return null;
        throw err;
      }
    }
    if (indexReady && cache.has(n)) return cache.get(n);
    const store = (await ready()).transaction("files", "readonly").objectStore("files");
    return new Promise((resolve, reject) => {
      const req = store.get(n);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function putFile(record) {
    const database = await ready();
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").put(record);
    await txDone(tx);
    if (indexReady) remember(record);
    return record;
  }

  async function remove(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    if (mounted) {
      if (n === mounted.root) throw new Error("EBUSY");
      await mounted.ops.remove(relOf(n, mounted.root), n);
      bustSearch();
      notify(n, "rm");
      return;
    }
    const database = await ready();
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").delete(n);
    await txDone(tx);
    if (indexReady) forget(path);
  }

  async function allFiles() {
    const store = (await ready()).transaction("files", "readonly").objectStore("files");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function ensureIndex() {
    if (indexReady) return;
    cache.clear();
    children.clear();
    const files = await allFiles();
    for (const f of files) remember(f);
    indexReady = true;
    recountRoot();
  }

  function setQuota(bytes, sweep) {
    quotaBytes = Math.max(0, Number(bytes) || 0);
    quotaSweep = typeof sweep === "function" ? sweep : null;
  }

  function quotaOf() {
    return quotaBytes;
  }

  async function checkQuota(delta) {
    if (!quotaBytes || !indexReady || delta <= 0 || quotaBusy) return;
    const used = rootUsage.dirty ? (await usage("/")).bytes : rootUsage.bytes;
    if (used + delta <= quotaBytes) return;
    if (quotaSweep) {
      quotaBusy = true;
      try {
        await quotaSweep({ need: used + delta - quotaBytes });
      } finally {
        quotaBusy = false;
      }
    }
    const used2 = rootUsage.dirty ? (await usage("/")).bytes : rootUsage.bytes;
    if (used2 + delta > quotaBytes) throw new Error("ENOSPC");
  }

  async function mkdir(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    if (mounted) {
      const rec = await mounted.ops.mkdir(relOf(n, mounted.root), n);
      bustSearch();
      notify(n, "put");
      return rec;
    }
    if (n === "/") {
      return { path: "/", type: "dir", body: "", mime: "inode/directory", updated: 0 };
    }
    const existing = await getFile(n);
    if (existing && existing.type !== "dir") throw new Error("ENOTDIR");
    if (existing) return existing;
    if (n !== "/") {
      const parent = parentOf(n);
      const p = await getFile(parent);
      if (!p) await mkdir(parent);
      else if (p.type !== "dir") throw new Error("ENOTDIR");
    }
    return putFile({
      path: n,
      type: "dir",
      body: "",
      mime: "inode/directory",
      updated: Date.now(),
    });
  }

  async function follow(path, hops = 0) {
    if (hops > 8) throw new Error("ELOOP");
    const n = normalize(path);
    const file = await getFile(n);
    if (!file) throw new Error("ENOENT");
    if (file.type === "link") {
      if (!file.target) throw new Error("ENOENT");
      return follow(file.target, hops + 1);
    }
    return file;
  }

  async function write(path, body, mime = "text/plain") {
    const n = normalize(path);
    if (n === "/") throw new Error("EPERM");
    const early = mountOf(n);
    if (early) {
      if (n === early.root) throw new Error("EISDIR");
      const rec = await early.ops.write(relOf(n, early.root), body, mime, n);
      bustSearch();
      notify(n, "put");
      return rec;
    }
    let dest = n;
    let prev = await getFile(n);
    if (prev && prev.type === "link") {
      let hops = 0;
      let cur = prev;
      while (cur && cur.type === "link") {
        if (hops > 8) throw new Error("ELOOP");
        hops += 1;
        dest = normalize(cur.target);
        cur = await getFile(dest);
      }
      prev = cur;
    }
    if (prev && prev.type === "dir") throw new Error("EISDIR");
    const destMount = mountOf(dest);
    if (destMount) {
      if (dest === destMount.root) throw new Error("EISDIR");
      const rec = await destMount.ops.write(relOf(dest, destMount.root), body, mime, dest);
      bustSearch();
      notify(dest, "put");
      return rec;
    }
    const nextBody = String(body ?? "");
    const prevLen = prev && prev.type !== "dir" ? String(prev.body || "").length : 0;
    await checkQuota(nextBody.length - prevLen);
    await mkdir(parentOf(dest));
    return putFile({
      path: dest,
      type: "file",
      body: nextBody,
      mime,
      origin: prev && prev.origin,
      exec: !!(prev && prev.exec),
      updated: Date.now(),
    });
  }

  async function read(path) {
    const file = await follow(path);
    if (file.type === "dir") throw new Error("EISDIR");
    return file;
  }

  async function link(target, dest) {
    const to = normalize(dest);
    if (to === "/") throw new Error("EPERM");
    const src = normalize(target);
    if (mountOf(to) || mountOf(src)) throw new Error("EPERM");
    if (await getFile(to)) throw new Error("EEXIST");
    await mkdir(parentOf(to));
    return putFile({
      path: to,
      type: "link",
      target: src,
      body: src,
      mime: "inode/symlink",
      updated: Date.now(),
    });
  }

  async function append(path, extra) {
    let prev = "";
    try {
      prev = (await follow(path)).body || "";
    } catch (err) {
      if (err.message !== "ENOENT") throw err;
    }
    const add = String(extra ?? "");
    const body = prev ? `${prev}\n${add}` : add;
    return write(path, body);
  }

  async function touch(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    if (mounted) {
      const prev = await getFile(n);
      if (prev && prev.type === "dir") return prev;
      if (!prev) return write(n, "");
      if (mounted.ops.touch) return mounted.ops.touch(relOf(n, mounted.root), n);
      return prev;
    }
    const prev = await getFile(n);
    if (prev && prev.type === "link") return touch(prev.target);
    if (prev) {
      prev.updated = Date.now();
      return putFile(prev);
    }
    return write(n, "");
  }

  async function ls(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    if (mounted) return mounted.ops.ls(relOf(n, mounted.root), n);
    await ensureIndex();
    if (n !== "/") {
      const dir = cache.get(n) || (await getFile(n));
      if (!dir) throw new Error("ENOENT");
      if (dir.type !== "dir") throw new Error("ENOTDIR");
    }
    const kids = children.get(n) || new Set();
    const rows = [...kids].map((p) => {
      const f = cache.get(p) || { path: p, type: "dir" };
      return { ...f, name: nameOf(p) };
    });
    return mergeMountKids(n, rows);
  }

  async function find(root, needle) {
    const n = normalize(root || "/");
    const q = String(needle || "").toLowerCase();
    const mounted = mountOf(n);
    if (mounted && mounted.ops.find) return mounted.ops.find(relOf(n, mounted.root), needle, n);
    await ensureIndex();
    const key = `${n}\0${q}`;
    const cached = memoGet(findMemo, key);
    if (cached) return cached.slice();
    const out = [];
    for (const [p, f] of cache) {
      if (!underRoot(p, n)) continue;
      if (p === n && f.type === "dir") continue;
      if (!q || p.toLowerCase().includes(q) || nameOf(p).toLowerCase().includes(q)) {
        out.push({ ...f, name: nameOf(p) });
      }
      if (out.length >= 200) break;
    }
    const extra = await gatherMountSearch(n, (m, root) =>
      m.ops.find ? m.ops.find("", needle, root) : []
    );
    const have = new Set(out.map((f) => f.path));
    for (const f of extra) {
      if (!have.has(f.path)) out.push(f);
      if (out.length >= 200) break;
    }
    memoSet(findMemo, key, out);
    return out.slice();
  }

  async function grep(root, pat) {
    if (!pat) throw new Error("EINVAL");
    const n = normalize(root || "/");
    const mounted = mountOf(n);
    if (mounted && mounted.ops.grep) return mounted.ops.grep(relOf(n, mounted.root), pat, n);
    await ensureIndex();
    const key = `${n}\0${pat}`;
    const cached = memoGet(grepMemo, key);
    if (cached) return cached.slice();
    const hits = [];
    for (const [p, f] of cache) {
      if (!underRoot(p, n)) continue;
      if (f.type === "dir" || typeof f.body !== "string" || !f.body.includes(pat)) continue;
      const line = f.body.split("\n").find((l) => l.includes(pat)) || "";
      hits.push(`${p}: ${line.slice(0, 140)}`);
      if (hits.length >= 80) break;
    }
    if (hits.length < 80) {
      const extra = await gatherMountSearch(n, (m, root) =>
        m.ops.grep ? m.ops.grep("", pat, root) : []
      );
      for (const line of extra) {
        hits.push(line);
        if (hits.length >= 80) break;
      }
    }
    memoSet(grepMemo, key, hits);
    return hits.slice();
  }

  async function usage(path) {
    const n = normalize(path || "/");
    const mounted = mountOf(n);
    if (mounted && mounted.ops.usage) return mounted.ops.usage(relOf(n, mounted.root), n);
    await ensureIndex();
    if (n === "/" && !rootUsage.dirty) {
      return { bytes: rootUsage.bytes, files: rootUsage.files, dirs: rootUsage.dirs };
    }
    const root = cache.get(n);
    if (root && root.type === "file") {
      return { bytes: (root.body || "").length, files: 1, dirs: 0 };
    }
    let bytes = 0;
    let files = 0;
    let dirs = 0;
    const seen = new Set();
    const walk = (dir) => {
      if (seen.has(dir)) return;
      seen.add(dir);
      for (const p of children.get(dir) || []) {
        const f = cache.get(p);
        if (!f || p === dir) continue;
        if (f.type === "dir") {
          dirs += 1;
          walk(p);
        } else {
          files += 1;
          bytes += (f.body || "").length;
        }
      }
    };
    walk(n);
    if (n !== "/") {
      const extra = await gatherMountSearch(n, (m, mountRoot) =>
        m.ops.usage ? m.ops.usage("", mountRoot).then((u) => [u]) : []
      );
      for (const u of extra) {
        bytes += u.bytes || 0;
        files += u.files || 0;
        dirs += u.dirs || 0;
      }
    }
    return { bytes, files, dirs };
  }

  async function chmod(path, exec) {
    if (mountOf(path)) throw new Error("EPERM");
    const f = await follow(path);
    if (f.type === "dir") throw new Error("EISDIR");
    f.exec = !!exec;
    f.updated = Date.now();
    return putFile(f);
  }

  async function copy(from, to) {
    const src = await getFile(from);
    if (!src) throw new Error("ENOENT");
    if (src.type === "dir") throw new Error("EISDIR");
    if (src.type === "link") return link(src.target, to);
    return write(to, src.body, src.mime || "text/plain");
  }

  async function copyTree(from, to) {
    const src = await getFile(from);
    if (!src) throw new Error("ENOENT");
    const dest = normalize(to);
    if (normalize(from) === dest) throw new Error("EINVAL");
    if (src.type === "dir") {
      await mkdir(dest);
      const kids = await ls(from);
      for (const k of kids) {
        await copyTree(k.path, normalize(`${dest}/${k.name}`));
      }
      return dest;
    }
    await copy(from, dest);
    return dest;
  }

  async function rename(from, to) {
    const srcPath = normalize(from);
    const dest = normalize(to);
    const fromM = mountOf(srcPath);
    const toM = mountOf(dest);
    if (fromM || toM) {
      if (await getFile(dest)) throw new Error("EEXIST");
      if (fromM && toM && fromM.root === toM.root && fromM.ops.rename) {
        await fromM.ops.rename(relOf(srcPath, fromM.root), relOf(dest, toM.root), srcPath, dest);
        bustSearch();
        notify(dest, "put");
        notify(srcPath, "rm");
        return;
      }
      await copyTree(srcPath, dest);
      await remove(srcPath);
      return;
    }
    const src = await getFile(from);
    if (!src) throw new Error("ENOENT");
    if (src.type === "dir") throw new Error("EXDEV");
    if (await getFile(dest)) throw new Error("EEXIST");
    await mkdir(parentOf(dest));
    await putFile({ ...src, path: dest, updated: Date.now() });
    await remove(from);
  }

  async function moveToMuen(path) {
    const n = normalize(path);
    const mounted = mountOf(n);
    const src = await getFile(n);
    if (!src) throw new Error("ENOENT");
    if (mounted) {
      if (n === mounted.root) throw new Error("EBUSY");
      const dest = `/var/muen/${Date.now()}-${nameOf(n)}`;
      await mkdir("/var/muen");
      if (src.type === "dir") await copyTree(n, dest);
      else {
        await putFile({
          path: dest,
          type: src.type,
          body: src.body || "",
          mime: src.mime || "text/plain",
          origin: n,
          target: src.target,
          exec: !!src.exec,
          updated: Date.now(),
        });
      }
      await remove(n);
      return dest;
    }
    const dest = `/var/muen/${Date.now()}-${nameOf(path)}`;
    await mkdir("/var/muen");
    await putFile({
      path: dest,
      type: src.type,
      body: src.body || "",
      mime: src.mime || "text/plain",
      origin: normalize(path),
      target: src.target,
      exec: !!src.exec,
      updated: Date.now(),
    });
    await remove(path);
    return dest;
  }

  async function purgeMuen() {
    await ensureIndex();
    const kids = [...(children.get("/var/muen") || [])];
    let n = 0;
    for (const p of kids) {
      const f = cache.get(p);
      if (!f || f.type === "dir") continue;
      await remove(p);
      n += 1;
    }
    return n;
  }

  async function restoreFromMuen(path, dest) {
    const src = await getFile(path);
    if (!src) throw new Error("ENOENT");
    const n = normalize(path);
    if (!n.startsWith("/var/muen/")) throw new Error("EXDEV");
    const name = nameOf(n).replace(/^\d+-/, "");
    const to = dest ? normalize(dest) : src.origin || `/var/restored/${name}`;
    if (src.type === "link") {
      await link(src.target, to);
    } else {
      await write(to, src.body, src.mime || "text/plain");
    }
    await remove(n);
    return to;
  }

  async function metaGet(key) {
    const store = (await ready()).transaction("meta", "readonly").objectStore("meta");
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async function metaSet(key, value) {
    const database = await ready();
    const tx = database.transaction("meta", "readwrite");
    tx.objectStore("meta").put({ key, value });
    await txDone(tx);
  }

  return {
    normalize,
    parentOf,
    nameOf,
    ready,
    ensureIndex,
    getFile,
    mkdir,
    write,
    read,
    ls,
    find,
    grep,
    usage,
    setQuota,
    quotaOf,
    follow,
    link,
    touch,
    append,
    chmod,
    copy,
    copyTree,
    rename,
    remove,
    moveToMuen,
    restoreFromMuen,
    purgeMuen,
    allFiles,
    metaGet,
    metaSet,
    watch,
    addMount,
    dropMount,
    mountOf,
    listMounts,
  };
}

export const pathUtil = { normalize, parentOf, nameOf };
