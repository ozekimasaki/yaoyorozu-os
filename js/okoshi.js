const META = "okoshi";
const CONF = "/etc/okoshi";
const MAX = 4;

const ALLOW = new Set([
  "oncall",
  "map",
  "proc",
  "fs",
  "editor",
  "fw",
  "net",
  "dmesg",
  "term",
  "sim",
  "ma",
  "cal",
  "clip",
  "sys",
  "muen",
  "oto",
  "watari",
  "kagami",
]);

function parseList(text) {
  const out = [];
  const seen = new Set();
  for (const line of String(text || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const id = t.split(/\s+/)[0];
    if (!ALLOW.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX) break;
  }
  return out;
}

export function attachOkoshi(kernel) {
  if (!kernel || kernel.okoshi) return kernel.okoshi;
  const vfs = kernel.vfs;
  let ids = [];
  let seedP = null;
  const rec = { lastErr: "" };

  function snapshot() {
    return { ids: ids.slice(), lastErr: rec.lastErr, ready: true };
  }

  function procText() {
    return [`count=${ids.length}`, ...ids.map((id) => `app=${id}`), rec.lastErr ? `err=${rec.lastErr}` : ""]
      .filter(Boolean)
      .join("\n");
  }

  function list() {
    return ids.slice();
  }

  async function persist() {
    const body = ["# okoshi", ...ids, ""].join("\n");
    try {
      await vfs.metaSet(META, ids);
    } catch (err) {
      /* meta */
    }
    try {
      await vfs.write(CONF, body, "text/plain");
    } catch (err) {
      /* conf */
    }
  }

  async function add(id) {
    const key = String(id || "").trim();
    if (!ALLOW.has(key)) throw new Error("EINVAL");
    if (!ids.includes(key)) {
      if (ids.length >= MAX) throw new Error("EAGAIN");
      ids = [...ids, key];
    }
    rec.lastErr = "";
    await persist();
    kernel.log(`okoshi +${key}`, "okoshi");
    kernel.emit("okoshi", snapshot());
    return list();
  }

  async function rm(id) {
    const key = String(id || "").trim();
    const next = ids.filter((x) => x !== key);
    if (next.length === ids.length) throw new Error("ENOENT");
    ids = next;
    rec.lastErr = "";
    await persist();
    kernel.log(`okoshi -${key}`, "okoshi");
    kernel.emit("okoshi", snapshot());
    return list();
  }

  async function seed() {
    let saved = null;
    try {
      saved = await vfs.metaGet(META);
    } catch (err) {
      saved = null;
    }
    if (Array.isArray(saved)) ids = parseList(saved.join("\n"));
    if (!(await vfs.getFile(CONF))) {
      await vfs.write(
        CONF,
        [
          "# okoshi",
          "# \u8d77\u3053\u3057\u306f\u3001\u5353\u304c\u70b9\u3044\u305f\u3068\u304d\u7acb\u3064\u672d\u3067\u3042\u308b\u3002",
          ids.join("\n"),
          "",
        ].join("\n"),
        "text/plain"
      );
    } else if (!ids.length) {
      try {
        const f = await vfs.read(CONF);
        ids = parseList(f.body);
      } catch (err) {
        /* conf */
      }
    }
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u8d77\u3053\u3057.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "sys", "gate/app");
      await vfs.mkdir(`${home}/.init`);
    }
  }

  seedP = seed().catch((err) => {
    rec.lastErr = err.message || "seed";
  });

  const api = {
    list,
    add,
    rm,
    snapshot,
    procText,
    allow: [...ALLOW],
    ready: seedP,
  };
  kernel.okoshi = api;
  return api;
}
