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

  function remember(record) {
    cache.set(record.path, record);
    if (record.path === "/") return;
    const p = parentOf(record.path);
    if (!children.has(p)) children.set(p, new Set());
    children.get(p).add(record.path);
  }

  function forget(path) {
    const n = normalize(path);
    cache.delete(n);
    const p = parentOf(n);
    const set = children.get(p);
    if (set) set.delete(n);
  }

  async function ready() {
    if (!db) db = await openDb();
    return db;
  }

  async function getFile(path) {
    const n = normalize(path);
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
    const database = await ready();
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").delete(normalize(path));
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
  }

  async function mkdir(path) {
    const n = normalize(path);
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
    await mkdir(parentOf(dest));
    return putFile({
      path: dest,
      type: "file",
      body: String(body ?? ""),
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
    const prev = await getFile(n);
    if (prev && prev.type === "link") return touch(prev.target);
    if (prev) {
      prev.updated = Date.now();
      return putFile(prev);
    }
    return write(n, "");
  }

  async function ls(path) {
    await ensureIndex();
    const n = normalize(path);
    if (n !== "/") {
      const dir = cache.get(n) || (await getFile(n));
      if (!dir) throw new Error("ENOENT");
      if (dir.type !== "dir") throw new Error("ENOTDIR");
    }
    const kids = children.get(n) || new Set();
    return [...kids].map((p) => {
      const f = cache.get(p) || { path: p, type: "dir" };
      return { ...f, name: nameOf(p) };
    });
  }

  async function find(root, needle) {
    await ensureIndex();
    const n = normalize(root || "/");
    const q = String(needle || "").toLowerCase();
    const out = [];
    const seen = new Set();
    const walk = (dir) => {
      if (seen.has(dir)) return;
      seen.add(dir);
      for (const p of children.get(dir) || []) {
        const f = cache.get(p);
        if (!f || p === dir) continue;
        if (!q || p.toLowerCase().includes(q) || nameOf(p).toLowerCase().includes(q)) {
          out.push({ ...f, name: nameOf(p) });
        }
        if (f.type === "dir") walk(p);
        if (out.length >= 200) return;
      }
    };
    walk(n);
    return out;
  }

  async function grep(root, pat) {
    if (!pat) throw new Error("EINVAL");
    await ensureIndex();
    const n = normalize(root || "/");
    const hits = [];
    const seen = new Set();
    const walk = (dir) => {
      if (seen.has(dir)) return;
      seen.add(dir);
      for (const p of children.get(dir) || []) {
        const f = cache.get(p);
        if (!f || p === dir) continue;
        if (f.type === "dir") walk(p);
        else if (typeof f.body === "string" && f.body.includes(pat)) {
          const line = f.body.split("\n").find((l) => l.includes(pat)) || "";
          hits.push(`${p}: ${line.slice(0, 140)}`);
        }
        if (hits.length >= 80) return;
      }
    };
    walk(n);
    return hits;
  }

  async function usage(path) {
    await ensureIndex();
    const n = normalize(path || "/");
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
    return { bytes, files, dirs };
  }

  async function chmod(path, exec) {
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

  async function rename(from, to) {
    const src = await getFile(from);
    if (!src) throw new Error("ENOENT");
    if (src.type === "dir") throw new Error("EXDEV");
    const dest = normalize(to);
    if (await getFile(dest)) throw new Error("EEXIST");
    await mkdir(parentOf(dest));
    await putFile({ ...src, path: dest, updated: Date.now() });
    await remove(from);
  }

  async function moveToMuen(path) {
    const src = await getFile(path);
    if (!src) throw new Error("ENOENT");
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
    follow,
    link,
    touch,
    append,
    chmod,
    copy,
    rename,
    remove,
    moveToMuen,
    restoreFromMuen,
    purgeMuen,
    allFiles,
    metaGet,
    metaSet,
  };
}

export const pathUtil = { normalize, parentOf, nameOf };
