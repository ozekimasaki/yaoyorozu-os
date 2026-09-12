const META = "utsuwa";
const CONF = "/etc/utsuwa";
const DEFAULT_QUOTA = 6 * 1024 * 1024;

function fmtBytes(n) {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)}M`;
  if (v >= 1024) return `${Math.round(v / 1024)}K`;
  return `${v}B`;
}

async function sizeOf(vfs, path) {
  try {
    const f = await vfs.getFile(path);
    return f && f.body ? String(f.body).length : 0;
  } catch (err) {
    return 0;
  }
}

export function attachUtsuwa(kernel) {
  if (!kernel || kernel.utsuwa) return kernel.utsuwa;
  const vfs = kernel.vfs;
  const rec = {
    quota: DEFAULT_QUOTA,
    bytes: 0,
    files: 0,
    dirs: 0,
    lastSweep: 0,
    dropped: 0,
    lastErr: "",
  };
  let seedP = null;
  let sweeping = false;

  function snapshot() {
    return {
      quota: rec.quota,
      bytes: rec.bytes,
      files: rec.files,
      dirs: rec.dirs,
      lastSweep: rec.lastSweep,
      dropped: rec.dropped,
      lastErr: rec.lastErr,
      over: rec.quota > 0 && rec.bytes > rec.quota,
      ready: true,
    };
  }

  function procText() {
    return [
      `bytes=${rec.bytes}`,
      `quota=${rec.quota}`,
      `files=${rec.files}`,
      `dirs=${rec.dirs}`,
      `over=${rec.quota > 0 && rec.bytes > rec.quota ? 1 : 0}`,
      `dropped=${rec.dropped}`,
      rec.lastErr ? `err=${rec.lastErr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function markDom() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.utsuwa = rec.quota > 0 && rec.bytes > rec.quota ? "full" : "live";
    const pill = document.getElementById("disk-pill");
    if (!pill) return;
    const text = `\u5668: ${rec.files}\u672d ${fmtBytes(rec.bytes)}/${fmtBytes(rec.quota)}`;
    if (pill.textContent !== text) pill.textContent = text;
  }

  function emit() {
    markDom();
    kernel.emit("utsuwa", snapshot());
  }

  async function refresh() {
    try {
      const u = await vfs.usage("/");
      rec.bytes = u.bytes || 0;
      rec.files = u.files || 0;
      rec.dirs = u.dirs || 0;
      rec.lastErr = "";
    } catch (err) {
      rec.lastErr = err.message || "usage";
    }
    markDom();
    return snapshot();
  }

  async function persist() {
    try {
      await vfs.metaSet(META, { quota: rec.quota });
    } catch (err) {
      /* meta */
    }
    try {
      await vfs.write(CONF, `quota=${rec.quota}\nbytes=${rec.bytes}\n`, "text/plain");
    } catch (err) {
      /* conf */
    }
  }

  async function setQuota(n) {
    const v = Math.max(256 * 1024, Number(n) || DEFAULT_QUOTA);
    rec.quota = v;
    if (kernel.state && kernel.state.settings) kernel.state.settings.quota = v;
    if (vfs.setQuota) vfs.setQuota(v, (opts) => sweep(opts));
    await persist();
    await refresh();
    emit();
    return rec.quota;
  }

  async function sweepDir(dir, keep) {
    let kids = [];
    try {
      kids = await vfs.ls(dir);
    } catch (err) {
      return { dropped: 0, bytes: 0 };
    }
    const files = kids
      .filter((k) => k && k.type !== "dir")
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    const extra = keep > 0 ? files.slice(0, Math.max(0, files.length - keep)) : files;
    let dropped = 0;
    let bytes = 0;
    for (const f of extra) {
      const sz = await sizeOf(vfs, f.path);
      try {
        await vfs.remove(f.path);
        dropped += 1;
        bytes += sz;
      } catch (err) {
        /* keep */
      }
    }
    return { dropped, bytes };
  }

  async function sweep(opts = {}) {
    if (sweeping) return { dropped: 0, bytes: 0 };
    sweeping = true;
    const hard = !!opts.hard || Number(opts.need) > 512 * 1024;
    let dropped = 0;
    let bytes = 0;
    try {
      const shots = await sweepDir("/var/utsushi", hard ? 4 : 8);
      dropped += shots.dropped;
      bytes += shots.bytes;
      const muen = await vfs.purgeMuen();
      dropped += muen || 0;
      const dmesg = await sweepDir("/var/dmesg", 0);
      dropped += dmesg.dropped;
      bytes += dmesg.bytes;
      rec.dropped += dropped;
      rec.lastSweep = Date.now();
      rec.lastErr = "";
      if (kernel.utsushi && kernel.utsushi.list) {
        try {
          await kernel.utsushi.list();
        } catch (err) {
          /* count */
        }
      }
      kernel.log(`utsuwa sweep dropped=${dropped} bytes=${bytes}`, "utsuwa");
      if (dropped) kernel.noteOshi(`\u5668\u3092\u6383\u3044\u305f ${dropped}`, "utsuwa");
      await refresh();
      emit();
      kernel.emit("vfs");
      return { dropped, bytes };
    } catch (err) {
      rec.lastErr = err.message || "sweep";
      emit();
      throw err;
    } finally {
      sweeping = false;
    }
  }

  async function seed() {
    let saved = null;
    try {
      saved = await vfs.metaGet(META);
    } catch (err) {
      saved = null;
    }
    if (saved && saved.quota) rec.quota = Math.max(256 * 1024, Number(saved.quota) || DEFAULT_QUOTA);
    else if (kernel.state && kernel.state.settings && kernel.state.settings.quota) {
      rec.quota = Math.max(256 * 1024, Number(kernel.state.settings.quota) || DEFAULT_QUOTA);
    }
    if (kernel.state && kernel.state.settings) kernel.state.settings.quota = rec.quota;
    if (!(await vfs.getFile(CONF))) {
      await vfs.write(
        CONF,
        [
          `quota=${rec.quota}`,
          "",
          "\u5668\u306f\u3001\u7e01fs \u306e\u5bb9\u308c\u308b\u91cf\u3067\u3042\u308b\u3002",
          "\u6e80\u3061\u305f\u3089\u7121\u7e01\u3068\u5199\u3057\u306e\u53e4\u3044\u672d\u3092\u6383\u304f\u3002",
          "",
        ].join("\n"),
        "text/plain"
      );
    }
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u5668.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "sys", "gate/app");
    }
    if (vfs.setQuota) vfs.setQuota(rec.quota, (opts) => sweep(opts));
    await refresh();
    markDom();
  }

  seedP = seed().catch((err) => {
    rec.lastErr = err.message || "seed";
    markDom();
  });

  const api = {
    snapshot,
    procText,
    refresh,
    sweep,
    setQuota,
    fmtBytes,
    ready: seedP,
  };
  kernel.utsuwa = api;
  markDom();
  return api;
}
