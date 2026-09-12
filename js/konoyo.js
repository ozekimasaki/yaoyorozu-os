import { pathUtil } from "./vfs.js";

const META = "konoyo.binds";
const ROOT = "/konoyo";
const MAX_BODY = 1572864;
const SKIP = new Set([".git", "node_modules", ".DS_Store", "Thumbs.db"]);
const TEXT_EXT = new Set([
  "ofuda",
  "txt",
  "md",
  "json",
  "css",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "svg",
  "csv",
  "tsv",
  "xml",
  "log",
  "oto",
  "cron",
  "assoc",
  "conf",
  "map",
  "yml",
  "yaml",
  "toml",
  "sh",
  "rc",
  "ini",
  "yaoyorozu",
]);

function supported() {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

function markDom() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.konoyo = supported() ? "1" : "0";
}

function mapErr(err) {
  const name = err && err.name;
  if (name === "AbortError") return new Error("EINTR");
  if (name === "NotAllowedError" || name === "SecurityError") return new Error("EPERM");
  if (name === "NotFoundError") return new Error("ENOENT");
  if (name === "TypeMismatchError") return new Error("ENOTDIR");
  if (err && /^(ENOENT|EPERM|EISDIR|ENOTDIR|ENOSPC|EINVAL|EXDEV|EBUSY|ENOSYS|EEXIST|EINTR)$/.test(err.message)) {
    return err;
  }
  return err;
}

function slugOf(name) {
  const raw = String(name || "shore")
    .trim()
    .replace(/[\\/]/g, "-")
    .replace(/\s+/g, "-");
  if (!raw || raw === "." || raw === "..") return "shore";
  return raw.slice(0, 48);
}

function isTextName(name) {
  const ext = String(name || "").split(".").pop().toLowerCase();
  return TEXT_EXT.has(ext);
}

function recOf(full, extra) {
  return {
    path: full,
    name: pathUtil.nameOf(full),
    type: extra.type,
    body: extra.body || "",
    mime: extra.mime || (extra.type === "dir" ? "inode/directory" : "text/plain"),
    updated: extra.updated || Date.now(),
    origin: "konoyo",
  };
}

function decodeBody(text) {
  const s = String(text ?? "");
  const m = /^data:([^;]+);base64,(.+)$/s.exec(s);
  if (!m) return s;
  const bin = atob(m[2]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function fileToBody(file) {
  const name = file.name || "";
  const type = file.type || "";
  if (file.size > MAX_BODY) return `[\u6b64\u5cb8 ${file.size}B ${name} ${type}]`.trim();
  if (type.startsWith("text/") || type === "application/json" || type === "image/svg+xml" || isTextName(name)) {
    return file.text();
  }
  if (type.startsWith("image/") || type.startsWith("audio/") || type.startsWith("video/")) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${type || "application/octet-stream"};base64,${btoa(bin)}`;
  }
  const text = await file.text();
  if (/[\x00-\x08\x0e-\x1f]/.test(text.slice(0, 200))) return `[\u6b64\u5cb8 ${file.size}B ${name}]`;
  return text;
}

function makeMemoryOps(files) {
  const map = new Map();

  function ensureParents(rel) {
    const parts = String(rel).split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      if (!map.has(acc)) {
        map.set(acc, { type: "dir", body: "", mime: "inode/directory", updated: Date.now() });
      }
    }
  }

  function hasKids(rel) {
    const prefix = rel ? `${rel}/` : "";
    for (const key of map.keys()) {
      if (prefix && key.startsWith(prefix)) return true;
      if (!rel && key) return true;
    }
    return false;
  }

  for (const [k, v] of Object.entries(files || {})) {
    const rel = String(k).replace(/^\/+/, "");
    if (!rel) continue;
    ensureParents(rel);
    map.set(rel, { type: "file", body: String(v), mime: "text/plain", updated: Date.now() });
  }

  function childRows(rel, full) {
    const prefix = rel ? `${rel}/` : "";
    const names = new Set();
    const out = [];
    for (const key of map.keys()) {
      if (rel && key !== rel && !key.startsWith(prefix)) continue;
      if (!rel) {
        const top = key.split("/")[0];
        if (names.has(top)) continue;
        names.add(top);
        const rec = map.get(top) || { type: "dir", body: "", mime: "inode/directory", updated: Date.now() };
        out.push({ ...recOf(`${full}/${top}`, rec), type: rec.type });
        continue;
      }
      if (key === rel) continue;
      if (!key.startsWith(prefix)) continue;
      const name = key.slice(prefix.length).split("/")[0];
      if (names.has(name)) continue;
      names.add(name);
      const child = `${prefix}${name}`;
      const rec = map.get(child) || { type: "dir", body: "", mime: "inode/directory", updated: Date.now() };
      out.push({ ...recOf(`${full}/${name}`, rec), type: rec.type });
    }
    return out;
  }

  return {
    async getFile(rel, full) {
      if (!rel) return recOf(full, { type: "dir", mime: "inode/directory" });
      if (map.has(rel)) {
        const rec = map.get(rel);
        return recOf(full, rec);
      }
      if (hasKids(rel)) return recOf(full, { type: "dir", mime: "inode/directory" });
      return null;
    },
    async ls(rel, full) {
      if (rel && map.has(rel) && map.get(rel).type !== "dir") throw new Error("ENOTDIR");
      if (rel && !map.has(rel) && !hasKids(rel)) throw new Error("ENOENT");
      return childRows(rel, full);
    },
    async write(rel, body, mime, full) {
      if (!rel) throw new Error("EISDIR");
      ensureParents(rel);
      const rec = { type: "file", body: String(body ?? ""), mime: mime || "text/plain", updated: Date.now() };
      map.set(rel, rec);
      return recOf(full, rec);
    },
    async mkdir(rel, full) {
      if (!rel) return recOf(full, { type: "dir", mime: "inode/directory" });
      if (map.has(rel) && map.get(rel).type !== "dir") throw new Error("ENOTDIR");
      ensureParents(rel);
      const rec = { type: "dir", body: "", mime: "inode/directory", updated: Date.now() };
      map.set(rel, rec);
      return recOf(full, rec);
    },
    async remove(rel) {
      if (!rel) throw new Error("EBUSY");
      if (!map.has(rel) && !hasKids(rel)) throw new Error("ENOENT");
      for (const key of [...map.keys()]) {
        if (key === rel || key.startsWith(`${rel}/`)) map.delete(key);
      }
    },
    async rename(fromRel, toRel) {
      if (!fromRel || !toRel) throw new Error("EINVAL");
      if (!map.has(fromRel) && !hasKids(fromRel)) throw new Error("ENOENT");
      if (map.has(toRel) || hasKids(toRel)) throw new Error("EEXIST");
      ensureParents(toRel);
      for (const key of [...map.keys()]) {
        if (key !== fromRel && !key.startsWith(`${fromRel}/`)) continue;
        const next = key === fromRel ? toRel : `${toRel}${key.slice(fromRel.length)}`;
        map.set(next, map.get(key));
        map.delete(key);
      }
    },
    async find(rel, needle, full) {
      const q = String(needle || "").toLowerCase();
      const out = [];
      for (const [key, rec] of map) {
        if (rel && key !== rel && !key.startsWith(`${rel}/`)) continue;
        if (rel && key === rel && rec.type === "dir") continue;
        const name = key.split("/").pop();
        const path = rel ? `${full}/${key.slice(rel.length).replace(/^\//, "")}` : `${full}/${key}`;
        const p = path.replace(/\/+/g, "/");
        if (!q || p.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
          out.push({ ...recOf(p, rec), name });
        }
        if (out.length >= 80) break;
      }
      return out;
    },
    async grep(rel, pat, full) {
      if (!pat) throw new Error("EINVAL");
      const hits = [];
      for (const [key, rec] of map) {
        if (rel && key !== rel && !key.startsWith(`${rel}/`)) continue;
        if (rec.type === "dir" || typeof rec.body !== "string" || !rec.body.includes(pat)) continue;
        const path = rel ? `${full}/${key.slice(rel.length).replace(/^\//, "")}` : `${full}/${key}`;
        const line = rec.body.split("\n").find((l) => l.includes(pat)) || "";
        hits.push(`${path.replace(/\/+/g, "/")}: ${line.slice(0, 140)}`);
        if (hits.length >= 80) break;
      }
      return hits;
    },
    async usage(rel) {
      let bytes = 0;
      let files = 0;
      let dirs = 0;
      if (rel && map.has(rel) && map.get(rel).type === "file") {
        return { bytes: (map.get(rel).body || "").length, files: 1, dirs: 0 };
      }
      for (const [key, rec] of map) {
        if (rel && key !== rel && !key.startsWith(`${rel}/`)) continue;
        if (rel && key === rel) continue;
        if (rec.type === "dir") dirs += 1;
        else {
          files += 1;
          bytes += (rec.body || "").length;
        }
      }
      return { bytes, files, dirs };
    },
  };
}

function makeFsaOps(rootHandle) {
  async function walkTo(rel) {
    if (!rel) return { handle: rootHandle, kind: "directory", name: "" };
    const parts = rel.split("/").filter(Boolean);
    let dir = rootHandle;
    for (let i = 0; i < parts.length; i += 1) {
      const last = i === parts.length - 1;
      const name = parts[i];
      if (!last) {
        dir = await dir.getDirectoryHandle(name);
        continue;
      }
      try {
        const file = await dir.getFileHandle(name);
        return { handle: file, kind: "file", parent: dir, name };
      } catch (err) {
        if (err && err.name === "TypeMismatchError") {
          const folder = await dir.getDirectoryHandle(name);
          return { handle: folder, kind: "directory", parent: dir, name };
        }
        try {
          const folder = await dir.getDirectoryHandle(name);
          return { handle: folder, kind: "directory", parent: dir, name };
        } catch (inner) {
          throw mapErr(inner);
        }
      }
    }
    return { handle: dir, kind: "directory", name: parts[parts.length - 1] || "" };
  }

  async function ensureDir(rel) {
    if (!rel) return rootHandle;
    const parts = rel.split("/").filter(Boolean);
    let dir = rootHandle;
    for (const name of parts) dir = await dir.getDirectoryHandle(name, { create: true });
    return dir;
  }

  return {
    async getFile(rel, full) {
      try {
        if (!rel) return recOf(full, { type: "dir", mime: "inode/directory" });
        const hit = await walkTo(rel);
        if (hit.kind === "directory") return recOf(full, { type: "dir", mime: "inode/directory" });
        const file = await hit.handle.getFile();
        const body = await fileToBody(file);
        return recOf(full, {
          type: "file",
          body,
          mime: file.type || (body.startsWith("data:") ? body.slice(5, body.indexOf(";")) : "text/plain"),
          updated: file.lastModified,
        });
      } catch (err) {
        const mapped = mapErr(err);
        if (mapped.message === "ENOENT") return null;
        throw mapped;
      }
    },
    async ls(rel, full) {
      try {
        const hit = rel ? await walkTo(rel) : { handle: rootHandle, kind: "directory" };
        if (hit.kind !== "directory") throw new Error("ENOTDIR");
        const out = [];
        for await (const [name, handle] of hit.handle.entries()) {
          if (SKIP.has(name)) continue;
          out.push(
            recOf(`${full}/${name}`, {
              type: handle.kind === "directory" ? "dir" : "file",
              mime: handle.kind === "directory" ? "inode/directory" : "text/plain",
            })
          );
        }
        return out;
      } catch (err) {
        throw mapErr(err);
      }
    },
    async write(rel, body, mime, full) {
      if (!rel) throw new Error("EISDIR");
      try {
        const parts = rel.split("/").filter(Boolean);
        const name = parts.pop();
        const dir = await ensureDir(parts.join("/"));
        const file = await dir.getFileHandle(name, { create: true });
        const writer = await file.createWritable();
        await writer.write(decodeBody(String(body ?? "")));
        await writer.close();
        return recOf(full, { type: "file", body: String(body ?? ""), mime: mime || "text/plain" });
      } catch (err) {
        throw mapErr(err);
      }
    },
    async mkdir(rel, full) {
      try {
        await ensureDir(rel);
        return recOf(full, { type: "dir", mime: "inode/directory" });
      } catch (err) {
        throw mapErr(err);
      }
    },
    async remove(rel) {
      if (!rel) throw new Error("EBUSY");
      try {
        const parts = rel.split("/").filter(Boolean);
        const name = parts.pop();
        const dir = parts.length ? await walkTo(parts.join("/")) : { handle: rootHandle, kind: "directory" };
        if (dir.kind !== "directory") throw new Error("ENOTDIR");
        await dir.handle.removeEntry(name, { recursive: true });
      } catch (err) {
        throw mapErr(err);
      }
    },
    async find(rel, needle, full) {
      const q = String(needle || "").toLowerCase();
      const out = [];
      async function walk(dirHandle, dirRel, dirFull, depth) {
        if (out.length >= 80 || depth > 4) return;
        for await (const [name, handle] of dirHandle.entries()) {
          if (out.length >= 80) return;
          if (SKIP.has(name)) continue;
          const childFull = `${dirFull}/${name}`;
          if (!q || name.toLowerCase().includes(q) || childFull.toLowerCase().includes(q)) {
            out.push(
              recOf(childFull, {
                type: handle.kind === "directory" ? "dir" : "file",
                mime: handle.kind === "directory" ? "inode/directory" : "text/plain",
              })
            );
          }
          if (handle.kind === "directory") {
            await walk(handle, dirRel ? `${dirRel}/${name}` : name, childFull, depth + 1);
          }
        }
      }
      try {
        const start = rel ? await walkTo(rel) : { handle: rootHandle, kind: "directory" };
        if (!start || start.kind !== "directory") return out;
        await walk(start.handle, rel, full, 0);
        return out;
      } catch (err) {
        throw mapErr(err);
      }
    },
    async grep(rel, pat, full) {
      if (!pat) throw new Error("EINVAL");
      const hits = [];
      let reads = 0;
      async function walk(dirHandle, dirRel, dirFull, depth) {
        if (hits.length >= 80 || depth > 4 || reads >= 40) return;
        for await (const [name, handle] of dirHandle.entries()) {
          if (hits.length >= 80 || reads >= 40) return;
          if (SKIP.has(name)) continue;
          const childFull = `${dirFull}/${name}`;
          if (handle.kind === "directory") {
            await walk(handle, dirRel ? `${dirRel}/${name}` : name, childFull, depth + 1);
            continue;
          }
          if (!isTextName(name)) continue;
          reads += 1;
          try {
            const file = await handle.getFile();
            if (file.size > MAX_BODY) continue;
            const text = await file.text();
            if (!text.includes(pat)) continue;
            const line = text.split("\n").find((l) => l.includes(pat)) || "";
            hits.push(`${childFull}: ${line.slice(0, 140)}`);
          } catch (err) {
            /* skip unread */
          }
        }
      }
      try {
        const start = rel ? await walkTo(rel) : { handle: rootHandle, kind: "directory" };
        if (!start || start.kind !== "directory") return hits;
        await walk(start.handle, rel, full, 0);
        return hits;
      } catch (err) {
        throw mapErr(err);
      }
    },
    async usage(rel) {
      let bytes = 0;
      let files = 0;
      let dirs = 0;
      let seen = 0;
      async function walk(dirHandle, depth) {
        if (seen >= 200 || depth > 6) return;
        for await (const [name, handle] of dirHandle.entries()) {
          if (seen >= 200) return;
          if (SKIP.has(name)) continue;
          seen += 1;
          if (handle.kind === "directory") {
            dirs += 1;
            await walk(handle, depth + 1);
          } else {
            files += 1;
            try {
              const file = await handle.getFile();
              bytes += file.size || 0;
            } catch (err) {
              /* skip */
            }
          }
        }
      }
      try {
        if (!rel) {
          await walk(rootHandle, 0);
          return { bytes, files, dirs };
        }
        const hit = await walkTo(rel);
        if (hit.kind === "file") {
          const file = await hit.handle.getFile();
          return { bytes: file.size || 0, files: 1, dirs: 0 };
        }
        await walk(hit.handle, 0);
        return { bytes, files, dirs };
      } catch (err) {
        throw mapErr(err);
      }
    },
  };
}

export function attachKonoyo(kernel) {
  const vfs = kernel.vfs;
  let binds = [];

  function list() {
    return binds.map((b) => ({
      id: b.id,
      name: b.name,
      awake: !!b.awake,
      kind: b.kind || "fsa",
      mode: b.mode || "readwrite",
      path: `${ROOT}/${b.id}`,
    }));
  }

  function procText() {
    const rows = list().map((b) => `bind\t${b.id}\t${b.name}\t${b.awake ? "awake" : "asleep"}\t${b.kind}`);
    return [`supported=${supported() ? 1 : 0}`, ...rows].join("\n");
  }

  function usedIds() {
    return new Set(binds.map((b) => b.id));
  }

  async function uniqueId(base) {
    const taken = usedIds();
    let id = base;
    let n = 2;
    while (taken.has(id) || vfs.mountOf(`${ROOT}/${id}`)) {
      id = `${base}-${n}`;
      n += 1;
    }
    return id;
  }

  async function persist() {
    const rows = binds
      .filter((b) => b.kind === "fsa" && b.handle)
      .map((b) => ({
        id: b.id,
        name: b.name,
        handle: b.handle,
        mode: b.mode || "readwrite",
        kind: "fsa",
      }));
    try {
      await vfs.metaSet(META, rows);
    } catch (err) {
      kernel.log(`konoyo persist: ${err.message}`, "konoyo");
    }
  }

  async function ensureRoot() {
    await vfs.mkdir(ROOT);
  }

  async function placeHolder(id) {
    const dir = `${ROOT}/${id}`;
    await vfs.mkdir(dir);
    const nap = `${dir}/\u4f11\u7720.txt`;
    if (!(await vfs.getFile(nap))) {
      await vfs.write(
        nap,
        `\u3053\u306e\u5323\u306e\u8a31\u53ef\u306f\u7720\u3063\u3066\u3044\u308b\u3002\u7e01fs\u306e\u300c\u8d77\u3053\u3059\u300d\u304b\u3001\u5949\u7d0d\u3067 konoyo wake ${id}\u3002\n`
      );
    }
  }

  async function clearHolder(id) {
    const dir = `${ROOT}/${id}`;
    const nap = `${dir}/\u4f11\u7720.txt`;
    try {
      if (!vfs.mountOf(nap)) await vfs.remove(nap);
    } catch (err) {
      /* holder */
    }
    try {
      if (!vfs.mountOf(dir)) await vfs.remove(dir);
    } catch (err) {
      /* holder */
    }
  }

  function emitChange() {
    kernel.emit("vfs");
    kernel.emit("konoyo");
  }

  async function bindDir() {
    if (!supported()) throw new Error("ENOSYS");
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: "readwrite" });
    } catch (err) {
      throw mapErr(err);
    }
    const id = await uniqueId(slugOf(handle.name));
    await ensureRoot();
    await vfs.mkdir(`${ROOT}/${id}`);
    vfs.addMount(`${ROOT}/${id}`, makeFsaOps(handle));
    const rec = {
      id,
      name: handle.name,
      handle,
      mode: "readwrite",
      kind: "fsa",
      awake: true,
    };
    binds = binds.filter((b) => b.id !== id);
    binds.push(rec);
    await persist();
    kernel.log(`konoyo bind ${id}`, "konoyo");
    kernel.noteJournal("konoyo", `bind ${id}`);
    emitChange();
    return list().find((b) => b.id === id);
  }

  async function bindMemory(id, files) {
    let sid = slugOf(id || "e2e");
    const prev = binds.find((b) => b.id === sid);
    if (prev) {
      vfs.dropMount(`${ROOT}/${sid}`);
      binds = binds.filter((b) => b.id !== sid);
    } else {
      sid = await uniqueId(sid);
    }
    await ensureRoot();
    await vfs.mkdir(`${ROOT}/${sid}`);
    vfs.addMount(`${ROOT}/${sid}`, makeMemoryOps(files || {}));
    const rec = { id: sid, name: sid, kind: "mem", mode: "readwrite", awake: true };
    binds.push(rec);
    kernel.log(`konoyo mem ${sid}`, "konoyo");
    emitChange();
    return list().find((b) => b.id === sid);
  }

  async function wake(id) {
    const rec = binds.find((b) => b.id === id);
    if (!rec) throw new Error("ENOENT");
    if (rec.kind === "mem") {
      rec.awake = true;
      emitChange();
      return list().find((b) => b.id === id);
    }
    if (!rec.handle) throw new Error("ENOENT");
    const mode = rec.mode || "readwrite";
    let perm = "granted";
    try {
      if (rec.handle.requestPermission) perm = await rec.handle.requestPermission({ mode });
    } catch (err) {
      throw mapErr(err);
    }
    if (perm !== "granted") throw new Error("EPERM");
    vfs.addMount(`${ROOT}/${rec.id}`, makeFsaOps(rec.handle));
    rec.awake = true;
    kernel.log(`konoyo wake ${id}`, "konoyo");
    kernel.noteJournal("konoyo", `wake ${id}`);
    emitChange();
    return list().find((b) => b.id === id);
  }

  async function unbind(id) {
    const rec = binds.find((b) => b.id === id);
    if (!rec) throw new Error("ENOENT");
    vfs.dropMount(`${ROOT}/${id}`);
    binds = binds.filter((b) => b.id !== id);
    await clearHolder(id);
    await persist();
    kernel.log(`konoyo unbind ${id}`, "konoyo");
    kernel.noteJournal("konoyo", `unbind ${id}`);
    emitChange();
    return id;
  }

  async function takeIn(destDir) {
    if (typeof window.showOpenFilePicker !== "function") throw new Error("ENOSYS");
    let handles;
    try {
      handles = await window.showOpenFilePicker({ multiple: true });
    } catch (err) {
      throw mapErr(err);
    }
    const dest = vfs.normalize(destDir || `/home/${kernel.state.ujiko}`);
    await vfs.mkdir(dest);
    const out = [];
    for (const handle of handles) {
      const file = await handle.getFile();
      const body = await fileToBody(file);
      const path = vfs.normalize(`${dest}/${file.name}`);
      await vfs.write(path, body, file.type || "text/plain");
      kernel.noteRecent(path);
      out.push(path);
    }
    emitChange();
    kernel.noteJournal("konoyo", `take ${out.length}`);
    return out;
  }

  async function sendOut(path) {
    if (typeof window.showSaveFilePicker !== "function") throw new Error("ENOSYS");
    const file = await vfs.read(path);
    const name = vfs.nameOf(path);
    let handle;
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name });
    } catch (err) {
      throw mapErr(err);
    }
    const writer = await handle.createWritable();
    await writer.write(decodeBody(file.body || ""));
    await writer.close();
    kernel.noteJournal("konoyo", `send ${name}`);
    return handle.name || name;
  }

  async function restore() {
    let saved = [];
    try {
      saved = (await vfs.metaGet(META)) || [];
    } catch (err) {
      saved = [];
    }
    if (!Array.isArray(saved)) saved = [];
    binds = [];
    await ensureRoot();
    for (const row of saved) {
      if (!row || !row.id || !row.handle) continue;
      const rec = {
        id: String(row.id),
        name: row.name || row.id,
        handle: row.handle,
        mode: row.mode || "readwrite",
        kind: "fsa",
        awake: false,
      };
      binds.push(rec);
      let perm = "prompt";
      try {
        perm = rec.handle.queryPermission ? await rec.handle.queryPermission({ mode: rec.mode }) : "granted";
      } catch (err) {
        perm = "prompt";
      }
      if (perm === "granted") {
        vfs.addMount(`${ROOT}/${rec.id}`, makeFsaOps(rec.handle));
        rec.awake = true;
      } else {
        await placeHolder(rec.id);
      }
    }
    markDom();
    if (binds.length) kernel.log(`konoyo restore ${binds.length}`, "konoyo");
  }

  kernel.konoyo = {
    supported,
    list,
    procText,
    bindDir,
    bindMemory,
    wake,
    unbind,
    takeIn,
    sendOut,
    restore,
  };
  markDom();
  return kernel.konoyo;
}
