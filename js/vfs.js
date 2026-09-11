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

  async function ready() {
    if (!db) db = await openDb();
    return db;
  }

  async function getFile(path) {
    const store = (await ready()).transaction("files", "readonly").objectStore("files");
    return new Promise((resolve, reject) => {
      const req = store.get(normalize(path));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function putFile(record) {
    const database = await ready();
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").put(record);
    await txDone(tx);
    return record;
  }

  async function remove(path) {
    const database = await ready();
    const tx = database.transaction("files", "readwrite");
    tx.objectStore("files").delete(normalize(path));
    await txDone(tx);
  }

  async function allFiles() {
    const store = (await ready()).transaction("files", "readonly").objectStore("files");
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function mkdir(path) {
    const n = normalize(path);
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

  async function write(path, body, mime = "text/plain") {
    const n = normalize(path);
    if (n === "/") throw new Error("EPERM");
    await mkdir(parentOf(n));
    const prev = await getFile(n);
    if (prev && prev.type === "dir") throw new Error("EISDIR");
    return putFile({
      path: n,
      type: "file",
      body: String(body ?? ""),
      mime,
      updated: Date.now(),
    });
  }

  async function read(path) {
    const file = await getFile(normalize(path));
    if (!file) throw new Error("ENOENT");
    if (file.type === "dir") throw new Error("EISDIR");
    return file;
  }

  async function ls(path) {
    const n = normalize(path);
    if (n !== "/") {
      const dir = await getFile(n);
      if (!dir) throw new Error("ENOENT");
      if (dir.type !== "dir") throw new Error("ENOTDIR");
    }
    const files = await allFiles();
    const prefix = n === "/" ? "/" : `${n}/`;
    const names = new Map();
    for (const f of files) {
      if (f.path === n) continue;
      if (n === "/") {
        const top = f.path.split("/").filter(Boolean)[0];
        if (top && !names.has(top)) {
          const child = files.find((x) => x.path === `/${top}`);
          names.set(top, child || { path: `/${top}`, type: "dir", name: top });
        }
      } else if (f.path.startsWith(prefix)) {
        const rest = f.path.slice(prefix.length);
        const name = rest.split("/")[0];
        if (!name) continue;
        const childPath = `${n}/${name}`;
        if (!names.has(name)) {
          const child = files.find((x) => x.path === childPath);
          names.set(name, child || { path: childPath, type: "dir", name });
        }
      }
    }
    return [...names.values()].map((f) => ({
      ...f,
      name: nameOf(f.path),
    }));
  }

  async function rename(from, to) {
    const src = await getFile(from);
    if (!src) throw new Error("ENOENT");
    if (src.type === "dir") throw new Error("EXDEV");
    await write(to, src.body, src.mime);
    await remove(from);
  }

  async function moveToMuen(path) {
    const src = await getFile(path);
    if (!src) throw new Error("ENOENT");
    const dest = `/var/muen/${Date.now()}-${nameOf(path)}`;
    await write(dest, src.body, src.mime || "text/plain");
    await remove(path);
    return dest;
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
    getFile,
    mkdir,
    write,
    read,
    ls,
    rename,
    remove,
    moveToMuen,
    allFiles,
    metaGet,
    metaSet,
  };
}

export const pathUtil = { normalize, parentOf, nameOf };
