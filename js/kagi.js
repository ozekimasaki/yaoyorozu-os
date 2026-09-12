const META = "kagi";
const CONF = "/etc/kagi";

function clampIdle(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(180, Math.max(1, Math.round(v)));
}

export function attachKagi(kernel) {
  if (!kernel || kernel.kagi) return kernel.kagi;
  const vfs = kernel.vfs;
  const rec = {
    locked: false,
    idleMin: 0,
    lastLock: 0,
    lastUnlock: 0,
    lastErr: "",
  };
  let lastActive = Date.now();
  let seedP = null;

  function snapshot() {
    return {
      locked: rec.locked,
      idleMin: rec.idleMin,
      lastLock: rec.lastLock,
      lastUnlock: rec.lastUnlock,
      lastErr: rec.lastErr,
      ready: true,
    };
  }

  function procText() {
    return [
      `locked=${rec.locked ? 1 : 0}`,
      `idle=${rec.idleMin}`,
      rec.lastErr ? `err=${rec.lastErr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function markDom() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.kagi = rec.locked ? "1" : "0";
    const veil = document.getElementById("kagi-veil");
    if (veil) {
      veil.classList.toggle("open", rec.locked);
      if (rec.locked) {
        const input = document.getElementById("kagi-kotoba");
        if (input) setTimeout(() => input.focus(), 0);
      }
    }
    const pill = document.getElementById("kagi-pill");
    if (pill) {
      pill.hidden = false;
      const text = rec.locked ? "\u9375: \u9589" : "\u9375: \u958b";
      if (pill.textContent !== text) pill.textContent = text;
      pill.classList.toggle("is-on", rec.locked);
    }
    const shade = document.querySelector("[data-shade=kagi]");
    if (shade) shade.classList.toggle("is-on", rec.locked);
  }

  function emit() {
    markDom();
    kernel.emit("kagi", snapshot());
  }

  async function persist() {
    try {
      await vfs.metaSet(META, { idleMin: rec.idleMin });
    } catch (err) {
      /* meta */
    }
    try {
      await vfs.write(CONF, `idle=${rec.idleMin}\n`, "text/plain");
    } catch (err) {
      /* conf */
    }
  }

  function lock() {
    if (rec.locked) return snapshot();
    rec.locked = true;
    rec.lastLock = Date.now();
    rec.lastErr = "";
    kernel.log("kagi lock", "kagi");
    kernel.noteOshi("\u9375\u3092\u304b\u3051\u305f", "kagi");
    emit();
    return snapshot();
  }

  function unlock(kotoba) {
    if (!rec.locked) return snapshot();
    const name = String(kotoba || "").trim();
    const ujiko = kernel.state && kernel.state.ujiko ? String(kernel.state.ujiko) : "";
    if (!name || !ujiko || name !== ujiko) {
      rec.lastErr = "EPERM";
      emit();
      throw new Error("EPERM");
    }
    rec.locked = false;
    rec.lastUnlock = Date.now();
    rec.lastErr = "";
    lastActive = Date.now();
    kernel.log("kagi unlock", "kagi");
    emit();
    return snapshot();
  }

  function unlockAuth() {
    if (!rec.locked) return snapshot();
    rec.locked = false;
    rec.lastUnlock = Date.now();
    rec.lastErr = "";
    lastActive = Date.now();
    kernel.log("kagi unlock auth", "kagi");
    emit();
    return snapshot();
  }

  async function setIdle(n) {
    rec.idleMin = clampIdle(n);
    if (kernel.state && kernel.state.settings) kernel.state.settings.kagiIdle = rec.idleMin;
    await persist();
    emit();
    return rec.idleMin;
  }

  function touch() {
    lastActive = Date.now();
  }

  function onTick() {
    if (rec.locked || !rec.idleMin) return;
    if (Date.now() - lastActive < rec.idleMin * 60000) return;
    lock();
  }

  async function seed() {
    let saved = null;
    try {
      saved = await vfs.metaGet(META);
    } catch (err) {
      saved = null;
    }
    if (saved && saved.idleMin != null) rec.idleMin = clampIdle(saved.idleMin);
    else if (kernel.state && kernel.state.settings && kernel.state.settings.kagiIdle != null) {
      rec.idleMin = clampIdle(kernel.state.settings.kagiIdle);
    }
    if (kernel.state && kernel.state.settings) kernel.state.settings.kagiIdle = rec.idleMin;
    if (!(await vfs.getFile(CONF))) {
      await vfs.write(
        CONF,
        [
          `idle=${rec.idleMin}`,
          "",
          "\u9375\u306f\u3001\u5353\u3092\u9589\u3058\u308b\u3002\u30ed\u30b0\u30a2\u30a6\u30c8\u3067\u306f\u306a\u3044\u3002",
          "\u6c0f\u5b50\u306e\u540d\u304b\u3001\u67cf\u624b\u3067\u5916\u3059\u3002",
          "",
        ].join("\n"),
        "text/plain"
      );
    }
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u9375.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "sys", "gate/app");
    }
    markDom();
  }

  seedP = seed().catch((err) => {
    rec.lastErr = err.message || "seed";
    markDom();
  });

  if (typeof document !== "undefined") {
    const bump = () => {
      if (!rec.locked) lastActive = Date.now();
    };
    document.addEventListener("pointerdown", bump, true);
    document.addEventListener("keydown", bump, true);
  }
  kernel.addEventListener("auth", () => {
    if (rec.locked) unlockAuth();
  });
  kernel.addEventListener("tick", onTick);

  const api = {
    lock,
    unlock,
    setIdle,
    touch,
    locked: () => rec.locked,
    snapshot,
    procText,
    ready: seedP,
  };
  kernel.kagi = api;
  markDom();
  return api;
}
