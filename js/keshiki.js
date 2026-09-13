const META = "keshiki";
const CONF = "/etc/keshiki";

function looksImg(name) {
  const n = String(name || "").toLowerCase();
  return (
    n.endsWith(".png") ||
    n.endsWith(".jpg") ||
    n.endsWith(".jpeg") ||
    n.endsWith(".webp") ||
    n.endsWith(".gif") ||
    n.endsWith(".utsushi")
  );
}

function srcOf(file) {
  const body = String((file && file.body) || "");
  if (body.startsWith("data:image")) return body;
  const mime = String((file && file.mime) || "");
  if (mime.startsWith("image/") && body) return body;
  return "";
}

function clampScale(n) {
  const v = Number(n);
  if (v === 0.9 || v === 1.15) return v;
  return 1;
}

function basename(path) {
  const p = String(path || "");
  return p.split("/").pop() || p;
}

export function attachKeshiki(kernel) {
  if (!kernel || kernel.keshiki) return kernel.keshiki;
  const vfs = kernel.vfs;
  const rec = {
    path: "",
    src: "",
    scale: 1,
    lastErr: "",
  };
  let seedP = null;

  function applyDom() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--ui-scale", String(rec.scale));
    root.dataset.scale = String(rec.scale);
    root.dataset.keshiki = rec.src ? "1" : "0";
    const veil = document.getElementById("keshiki-veil");
    if (veil) {
      if (rec.src) {
        veil.style.backgroundImage = `url("${rec.src}")`;
        veil.hidden = false;
      } else {
        veil.style.backgroundImage = "";
        veil.hidden = true;
      }
    }
    const field = document.getElementById("kami-field");
    if (field) field.hidden = !!rec.src;
    const pill = document.getElementById("keshiki-pill");
    if (pill) {
      const on = !!rec.path;
      pill.hidden = !on;
      const label = on ? `\u666f\u8272  ${basename(rec.path)}` : "\u666f\u8272";
      if (pill.textContent !== label) pill.textContent = label;
    }
  }

  function snapshot() {
    return {
      path: rec.path,
      scale: rec.scale,
      lastErr: rec.lastErr,
      ready: true,
      has: !!rec.src,
    };
  }

  function procText() {
    return [
      `path=${rec.path || ""}`,
      `scale=${rec.scale}`,
      `has=${rec.src ? 1 : 0}`,
      rec.lastErr ? `err=${rec.lastErr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function emit() {
    applyDom();
    kernel.emit("keshiki", snapshot());
  }

  async function persist() {
    const body = `path=${rec.path}\nscale=${rec.scale}\n`;
    try {
      await vfs.metaSet(META, { path: rec.path, scale: rec.scale });
    } catch (err) {
      /* meta */
    }
    try {
      await vfs.write(CONF, body, "text/plain");
    } catch (err) {
      /* conf */
    }
  }

  async function set(path) {
    const dest = String(path || "").trim();
    if (!dest || dest === CONF) {
      rec.lastErr = "EINVAL";
      emit();
      throw new Error("EINVAL");
    }
    const file = await kernel.readPath(dest);
    const src = srcOf(file);
    const mime = String((file && file.mime) || "");
    if (!src || (!looksImg(file.path || dest) && !mime.startsWith("image/"))) {
      rec.lastErr = "EINVAL";
      emit();
      throw new Error("EINVAL");
    }
    rec.path = file.path || dest;
    rec.src = src;
    rec.lastErr = "";
    await persist();
    if (kernel.state && kernel.state.settings) kernel.state.settings.scale = rec.scale;
    kernel.log(`keshiki ${rec.path}`, "keshiki");
    kernel.noteOshi(`\u666f\u8272\u3092\u6577\u3044\u305f ${basename(rec.path)}`, "keshiki");
    emit();
    return snapshot();
  }

  async function clear() {
    rec.path = "";
    rec.src = "";
    rec.lastErr = "";
    await persist();
    kernel.log("keshiki clear", "keshiki");
    emit();
    return snapshot();
  }

  async function fromLast() {
    let last = "";
    if (kernel.utsushi && kernel.utsushi.snapshot) {
      last = kernel.utsushi.snapshot().last || "";
    }
    if (!last && kernel.utsushi && kernel.utsushi.list) {
      const rows = await kernel.utsushi.list();
      if (rows.length) last = rows[rows.length - 1].path;
    }
    if (!last) {
      rec.lastErr = "ENOENT";
      emit();
      throw new Error("ENOENT");
    }
    return set(last);
  }

  async function setScale(n) {
    rec.scale = clampScale(n);
    if (kernel.state && kernel.state.settings) kernel.state.settings.scale = rec.scale;
    await persist();
    emit();
    kernel.emit("settings");
    if (kernel.commit) kernel.commit();
    return rec.scale;
  }

  async function seed() {
    if (!(await vfs.getFile(CONF))) {
      await vfs.write(
        CONF,
        [
          "path=",
          "scale=1",
          "",
          "\u666f\u8272\u306f\u3001\u5353\u306e\u80cc\u306b\u6577\u304f\u6620\u3057\u3067\u3042\u308b\u3002",
          "\u93e1\u306e\u300c\u5353\u3078\u300d\u304b\u6a5f\u68b0\u3067\u6577\u304f\u3002",
          "",
        ].join("\n"),
        "text/plain"
      );
    }
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u666f\u8272.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "sys", "gate/app");
    }
    let saved = null;
    try {
      saved = await vfs.metaGet(META);
    } catch (err) {
      saved = null;
    }
    if (saved && saved.scale != null) rec.scale = clampScale(saved.scale);
    else if (kernel.state && kernel.state.settings && kernel.state.settings.scale != null) {
      rec.scale = clampScale(kernel.state.settings.scale);
    }
    if (kernel.state && kernel.state.settings) kernel.state.settings.scale = rec.scale;
    if (saved && saved.path) {
      try {
        const file = await kernel.readPath(saved.path);
        const src = srcOf(file);
        if (src) {
          rec.path = file.path || saved.path;
          rec.src = src;
        }
      } catch (err) {
        rec.lastErr = err.message || "restore";
      }
    }
    applyDom();
  }

  seedP = seed().catch((err) => {
    rec.lastErr = err.message || "seed";
    applyDom();
  });

  const api = {
    set,
    clear,
    fromLast,
    setScale,
    snapshot,
    procText,
    apply: applyDom,
    ready: seedP,
  };
  kernel.keshiki = api;
  applyDom();
  return api;
}
