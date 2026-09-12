const ROOT = "/var/utsushi";
const KEEP = 16;

function supported() {
  return typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined";
}

function hexId(n = 6) {
  let s = "";
  while (s.length < n) s += Math.random().toString(16).slice(2);
  return s.slice(0, n);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function looksShot(name) {
  const n = String(name || "").toLowerCase();
  return n.endsWith(".png") || n.endsWith(".utsushi") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp");
}

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function paintScene(ctx, width, height) {
  ctx.fillStyle = "#0c0b09";
  ctx.fillRect(0, 0, width, height);
  const field = document.getElementById("kami-field");
  if (field && field.width && field.height) {
    try {
      ctx.drawImage(field, 0, 0, width, height);
    } catch (err) {
      /* tainted */
    }
  }
  const icons = document.querySelectorAll(".desk-icon");
  for (const el of icons) {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    ctx.fillStyle = "rgba(26, 22, 16, 0.78)";
    roundRect(ctx, r.left, r.top, r.width, r.height, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(201, 162, 39, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#e6c96a";
    ctx.font = "12px 'Shippori Mincho', serif";
    ctx.fillText((el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 14), r.left + 8, r.top + r.height - 8);
  }
  const wins = document.querySelectorAll(".window:not(.is-min):not(.is-away)");
  for (const win of wins) {
    const r = win.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    ctx.fillStyle = "#16130e";
    ctx.fillRect(r.left, r.top, r.width, r.height);
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(r.left, r.top, r.width, 28);
    ctx.fillStyle = "#1a1610";
    ctx.font = "13px 'Shippori Mincho', serif";
    const title = win.querySelector(".titlebar")?.textContent || win.dataset.app || "";
    ctx.fillText(title.replace(/\s+/g, " ").trim().slice(0, 28), r.left + 10, r.top + 18);
    const media = win.querySelector(".win-body canvas, .win-body img, .win-body video, .win-body svg");
    if (media) {
      try {
        ctx.drawImage(media, r.left, r.top + 28, r.width, Math.max(1, r.height - 28));
      } catch (err) {
        /* media */
      }
    }
    ctx.strokeStyle = "rgba(201, 162, 39, 0.45)";
    ctx.strokeRect(r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1);
  }
  const bar = document.getElementById("taskbar");
  if (bar) {
    const cs = getComputedStyle(bar);
    if (cs.display !== "none") {
      const r = bar.getBoundingClientRect();
      ctx.fillStyle = "#1a1610";
      ctx.fillRect(r.left, r.top, r.width, r.height);
      ctx.fillStyle = "#d9ccb0";
      ctx.font = "11px 'Zen Kaku Gothic New', sans-serif";
      ctx.fillText((bar.textContent || "").replace(/\s+/g, " ").trim().slice(0, 96), r.left + 10, r.top + Math.max(14, r.height * 0.62));
    }
  }
  const dock = document.getElementById("phone-dock");
  if (dock && document.documentElement.classList.contains("is-phone")) {
    const r = dock.getBoundingClientRect();
    if (r.height > 4) {
      ctx.fillStyle = "#1a1610";
      ctx.fillRect(r.left, r.top, r.width, r.height);
      ctx.fillStyle = "#e6c96a";
      ctx.font = "11px 'Zen Kaku Gothic New', sans-serif";
      ctx.fillText((dock.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48), r.left + 10, r.top + Math.max(14, r.height * 0.6));
    }
  }
}

function flash() {
  if (typeof document === "undefined") return;
  const veil = document.getElementById("norito-veil");
  document.documentElement.dataset.utsushi = "still";
  document.documentElement.classList.add("is-utsushi");
  if (veil) veil.classList.add("is-flash");
  setTimeout(() => {
    document.documentElement.classList.remove("is-utsushi");
    if (veil) veil.classList.remove("is-flash");
    document.documentElement.dataset.utsushi = "live";
  }, 220);
}

export function attachUtsushi(kernel) {
  if (!kernel || kernel.utsushi) return kernel.utsushi;
  const vfs = kernel.vfs;
  const rec = {
    last: "",
    count: 0,
    bytes: 0,
    lastErr: "",
    at: 0,
  };
  let seedP = null;

  function ujiko() {
    return (kernel.state && kernel.state.ujiko) || "ujiko";
  }

  function markDom() {
    if (typeof document === "undefined") return;
    if (!document.documentElement.dataset.utsushi) {
      document.documentElement.dataset.utsushi = supported() ? "live" : "0";
    }
    const pill = document.getElementById("utsushi-pill");
    if (!pill) return;
    const show = !!rec.last || rec.count > 0;
    pill.hidden = !show;
    const label = rec.count > 0 ? `\u5199\u3057  ${rec.count}` : "\u5199\u3057";
    if (pill.textContent !== label) pill.textContent = label;
  }

  function emit() {
    markDom();
    kernel.emit("utsushi", { ...rec });
  }

  function procText() {
    return [
      `supported=${supported() ? 1 : 0}`,
      `state=${document.documentElement?.dataset?.utsushi || (supported() ? "live" : "0")}`,
      `last=${rec.last || ""}`,
      `count=${rec.count || 0}`,
      `bytes=${rec.bytes || 0}`,
      rec.lastErr ? `err=${rec.lastErr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function snapshot() {
    return {
      last: rec.last,
      count: rec.count,
      bytes: rec.bytes,
      at: rec.at,
      lastErr: rec.lastErr,
      supported: supported(),
      ready: true,
    };
  }

  async function ensureRoot() {
    await vfs.mkdir(ROOT);
  }

  async function seed() {
    await ensureRoot();
    const note = `${ROOT}/\u5199\u3057.txt`;
    if (!(await vfs.getFile(note))) {
      await vfs.write(
        note,
        [
          "\u5199\u3057\u306f\u3001\u3053\u306e\u5353\u306e\u6620\u3057\u3067\u3042\u308b\u3002",
          "F8 \u304b\u8ed2\u306e\u300c\u5199\u3059\u300d\u3067\u6620\u3059\u3002",
          "\u672d\u306f /var/utsushi \u3078\u5c4a\u304f\u3002\u93e1\u3067\u898b\u308b\u3002",
          "",
        ].join("\n"),
        "text/plain"
      );
    }
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u5199\u3057.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "kagami", "gate/app");
    }
    await refreshCount();
    markDom();
  }

  async function listShots() {
    let kids = [];
    try {
      kids = await vfs.ls(ROOT);
    } catch (err) {
      kids = [];
    }
    return kids
      .filter((k) => k.type !== "dir" && looksShot(k.name))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }

  async function refreshCount() {
    const shots = await listShots();
    rec.count = shots.length;
    if (!rec.last && shots.length) rec.last = shots[shots.length - 1].path;
    return shots;
  }

  async function prune(shots) {
    const extra = shots.length - KEEP;
    if (extra <= 0) return;
    for (const f of shots.slice(0, extra)) {
      try {
        await vfs.remove(f.path);
      } catch (err) {
        /* keep */
      }
    }
  }

  async function snap(opts = {}) {
    if (!supported()) {
      rec.lastErr = "ENOSYS";
      emit();
      throw new Error("ENOSYS");
    }
    await ensureRoot();
    const reason = String((opts && opts.reason) || "user");
    const w = Math.max(1, window.innerWidth || 1);
    const h = Math.max(1, window.innerHeight || 1);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      rec.lastErr = "ENOSYS";
      emit();
      throw new Error("ENOSYS");
    }
    ctx.scale(dpr, dpr);
    flash();
    paintScene(ctx, w, h);
    let data = "";
    try {
      data = canvas.toDataURL("image/png");
    } catch (err) {
      rec.lastErr = err.message || "tainted";
      emit();
      throw err;
    }
    if (!data || !data.startsWith("data:image")) {
      rec.lastErr = "empty";
      emit();
      throw new Error("empty");
    }
    const name = `utsushi-${stamp()}-${hexId(4)}.png`;
    const path = `${ROOT}/${name}`;
    await vfs.write(path, data, "image/png");
    rec.last = path;
    rec.bytes = data.length;
    rec.at = Date.now();
    rec.lastErr = "";
    const shots = await refreshCount();
    await prune(shots);
    await refreshCount();
    try {
      await vfs.write(`${ROOT}/last`, path, "text/plain");
    } catch (err) {
      /* last */
    }
    kernel.log(`utsushi ${path} reason=${reason} bytes=${rec.bytes}`, "utsushi");
    kernel.noteOshi(`\u5199\u3057\u305f ${name}`, "utsushi");
    emit();
    return { path, bytes: rec.bytes, reason };
  }

  seedP = seed().catch((err) => {
    rec.lastErr = err.message || "seed";
    markDom();
  });

  const api = {
    supported,
    snap,
    snapshot,
    procText,
    list: listShots,
    ready: seedP,
    root: ROOT,
  };
  kernel.utsushi = api;
  markDom();
  return api;
}
