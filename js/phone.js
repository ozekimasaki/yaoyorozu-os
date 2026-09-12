import { listHandlers, sharePath } from "./runtime.js";
import { attachOto } from "./oto-kern.js";

const HAND_LABEL = {
  editor: "\u8a00\u970a",
  fs: "\u7e01fs",
  term: "\u5949\u7d0d",
  clip: "\u63a7\u3048",
  cal: "\u796d\u66a6",
  muen: "\u7121\u7e01",
  oncall: "\u5f53\u76f4",
  oto: "\u97f3\u970a",
};

export function isPhone() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return w <= 720 || (h <= 480 && w <= 980);
}

function applyClass(on) {
  document.documentElement.classList.toggle("is-phone", on);
  document.body.classList.toggle("is-phone", on);
  document.getElementById("desktop")?.classList.toggle("is-phone", on);
}

export function bindPhone({ kernel, wm, launch, openPath, openTorii, openKashiwa, openSpaces }) {
  attachOto(kernel);
  applyClass(isPhone());
  if (wm && wm.setPhone) wm.setPhone(isPhone());

  const dock = document.getElementById("phone-dock");
  const bar = document.getElementById("phone-homebar");
  const recents = document.getElementById("phone-recents");
  const track = document.getElementById("phone-recents-track");
  const shade = document.getElementById("phone-shade");
  const shadeOshi = document.getElementById("phone-shade-oshi");
  const shadeJournal = document.getElementById("phone-shade-journal");
  const shadeOto = document.getElementById("phone-shade-oto");
  const shadeOtoKick = document.getElementById("phone-shade-oto-kicker");
  const shadeHit = document.getElementById("phone-shade-hit");
  const nowBar = document.getElementById("phone-now");
  let splitPick = 0;
  const actions = document.getElementById("phone-actions");
  const actionsTrack = document.getElementById("phone-actions-track");
  const actionsKick = document.getElementById("phone-actions-kicker");

  function frontApp() {
    if (!wm) return null;
    return (
      wm.list().find((w) => !w.minimized && !w.el.classList.contains("is-away") && !w.el.classList.contains("is-phone-back")) ||
      null
    );
  }

  function sheetsOpen() {
    return (recents && !recents.hidden) || (shade && !shade.hidden) || (actions && !actions.hidden);
  }

  function closeSheets() {
    if (recents) recents.hidden = true;
    if (shade) shade.hidden = true;
    if (actions) actions.hidden = true;
    splitPick = 0;
  }

  function paintDock() {
    if (!dock) return;
    const front = frontApp();
    dock.querySelectorAll("[data-phone]").forEach((btn) => {
      const id = btn.dataset.phone;
      btn.classList.toggle("is-on", front ? front.appId === id : id === "home");
    });
    document.getElementById("desktop")?.classList.toggle("is-app", !!front);
    paintOto();
  }

  function otoNow() {
    return (kernel.state && kernel.state.oto) || { title: "", state: "still", pid: 0 };
  }

  function paintOto() {
    const now = otoNow();
    const ringing = now.state === "live" || now.state === "ma";
    const pill = document.getElementById("oto-pill");
    if (pill) {
      pill.hidden = !ringing;
      pill.classList.toggle("is-live", now.state === "live");
      pill.textContent = ringing ? `${now.state === "ma" ? "\u9593" : "\u9cf4\u308b"}  ${now.title}` : "\u97f3\u970a";
    }
    const front = frontApp();
    const showBar = ringing && !(front && front.appId === "oto");
    if (nowBar) {
      nowBar.hidden = !showBar;
      nowBar.dataset.state = now.state || "still";
      const title = document.getElementById("phone-now-open");
      if (title) title.textContent = now.title || "\u97f3\u970a";
      const tog = document.getElementById("phone-now-toggle");
      if (tog) tog.textContent = now.state === "live" ? "\u9593" : "\u62db\u304f";
    }
    if (shadeOtoKick) shadeOtoKick.hidden = !ringing;
    if (shadeOto) {
      shadeOto.hidden = !ringing;
      const t = document.getElementById("phone-shade-oto-title");
      if (t) t.textContent = ringing ? `${now.state === "ma" ? "\u9593" : "\u9cf4\u308b"}  ${now.title}` : "";
      shadeOto.querySelectorAll("[data-oto=toggle]").forEach((b) => {
        b.textContent = now.state === "live" ? "\u9593" : "\u62db\u304f";
      });
    }
  }

  function openNow() {
    const now = otoNow();
    closeSheets();
    if (wm && now.pid) {
      const w = wm.list().find((x) => x.pid === now.pid);
      if (w) {
        wm.restore(w.pid);
        wm.focus(w.pid);
        paintDock();
        return w;
      }
    }
    return resumeOrLaunch("oto");
  }

  function paintSpace() {
    const el = document.getElementById("phone-space");
    if (el) el.textContent = kernel.spacePref().name;
  }

  function goHome() {
    closeSheets();
    if (!wm) return;
    wm.hideAll();
    document.getElementById("desktop")?.classList.remove("is-app");
    paintDock();
  }

  function recentWins() {
    if (!wm) return [];
    return wm
      .list()
      .filter((w) => !w.el.classList.contains("is-away"))
      .slice()
      .sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
  }

  function openRecents() {
    if (!recents || !track || !wm) return;
    if (shade) shade.hidden = true;
    if (actions) actions.hidden = true;
    const rows = recentWins();
    track.replaceChildren();
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "\u8d70\u3063\u3066\u3044\u308b\u5834\u9762\u306f\u306a\u3044";
      track.appendChild(p);
    } else {
      for (const w of rows) {
        const card = document.createElement("div");
        card.className = "phone-card";
        card.dataset.pid = String(w.pid);
        const chrome = document.createElement("div");
        chrome.className = "phone-card-chrome";
        const title = document.createElement("strong");
        title.textContent = w.title || w.appId;
        const close = document.createElement("button");
        close.type = "button";
        close.dataset.close = String(w.pid);
        close.setAttribute("aria-label", "close");
        close.textContent = "\u00d7";
        const splitBtn = document.createElement("button");
        splitBtn.type = "button";
        splitBtn.dataset.split = String(w.pid);
        splitBtn.textContent = "\u4e26\u3076";
        chrome.append(title, splitBtn, close);
        const body = document.createElement("div");
        body.className = "phone-card-body";
        const proc = (kernel.state.appProcs || []).find((p) => p.pid === w.pid);
        body.textContent = `${w.appId} \u00b7 ${w.pid} \u00b7 ${proc?.status || "running"}`;
        card.append(chrome, body);
        bindCardSwipe(card, w.pid);
        track.appendChild(card);
      }
    }
    recents.hidden = false;
  }

  function bindCardSwipe(card, pid) {
    let y0 = 0;
    let x0 = 0;
    let dragging = false;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      y0 = e.clientY;
      x0 = e.clientX;
      try {
        card.setPointerCapture(e.pointerId);
      } catch (err) {
        /* capture */
      }
    });
    card.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - y0;
      card.style.transform = dy < 0 ? `translateY(${dy}px)` : "";
    });
    card.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.clientY - y0;
      const dx = Math.abs(e.clientX - x0);
      card.style.transform = "";
      if (dy < -72 && dx < 90 && wm) {
        wm.close(pid);
        openRecents();
        paintDock();
      }
    });
    card.addEventListener("pointercancel", () => {
      dragging = false;
      card.style.transform = "";
    });
  }

  function paintShadeHit() {
    if (!shadeHit) return;
    const n = kernel.state.oshiUnread || 0;
    shadeHit.classList.toggle("has-note", n > 0);
    shadeHit.textContent = n > 0 ? `\u544a\u3052 ${n}` : "\u544a\u3052";
  }

  function paintShadeJournal() {
    if (!shadeJournal) return;
    shadeJournal.replaceChildren();
    const rows = kernel.state.journal || [];
    if (!rows.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "\uff08\u65e5\u8a8c\u306f\u307e\u3060\u7a7a\uff09";
      shadeJournal.appendChild(p);
      return;
    }
    for (const r of rows.slice(0, 12)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "phone-journal";
      if (r.path) b.dataset.path = r.path;
      b.textContent = `${r.tag}  ${r.t}`;
      shadeJournal.appendChild(b);
    }
  }

  function openShade() {
    if (!shade) return;
    if (recents) recents.hidden = true;
    if (actions) actions.hidden = true;
    const rows = kernel.state.oshi || [];
    if (shadeOshi) {
      shadeOshi.textContent = rows.map((r) => `${r.tag}  ${r.t}`).join("\n") || "\uff08\u672d\u306f\u5c4a\u3044\u3066\u3044\u306a\u3044\uff09";
    }
    const silentBtn = shade.querySelector("[data-shade=silent]");
    if (silentBtn) silentBtn.classList.toggle("is-on", !!(kernel.state.settings && kernel.state.settings.silent));
    paintShadeJournal();
    paintOto();
    shade.hidden = false;
    kernel.readOshi();
    paintShadeHit();
  }

  async function openActions(path) {
    if (!actions || !actionsTrack || !path) return;
    if (recents) recents.hidden = true;
    if (shade) shade.hidden = true;
    if (actionsKick) actionsKick.textContent = path.split("/").pop() || path;
    actionsTrack.replaceChildren();
    const mk = (label, attrs) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      for (const [k, v] of Object.entries(attrs)) b.dataset[k] = v;
      actionsTrack.appendChild(b);
    };
    mk("\u304f\u3050\u308b", { act: "open", path });
    try {
      const rows = await listHandlers(path);
      for (const row of rows) {
        mk(`${HAND_LABEL[row.id] || row.id}\u3067\u958b\u304f`, { with: row.id, path });
      }
    } catch (err) {
      /* assoc */
    }
    mk("\u5c5e\u6027", { act: "stat", path });
    mk("\u9053\u3092\u5199\u3059", { act: "copy", path });
    mk("\u7121\u7e01\u3078", { act: "muen", path });
    mk(`${HAND_LABEL.clip}\u3078\u6e21\u3059`, { share: "clip", path });
    mk(`${HAND_LABEL.term}\u3078\u6e21\u3059`, { share: "term", path });
    mk(`${HAND_LABEL.oto}\u3078\u6e21\u3059`, { share: "oto", path });
    actions.hidden = false;
  }

  function resumeOrLaunch(id) {
    closeSheets();
    if (!wm) return launch(id);
    const hit = wm.list().find((w) => w.appId === id && !w.el.classList.contains("is-away"));
    if (hit) {
      wm.restore(hit.pid);
      wm.focus(hit.pid);
      paintDock();
      return hit;
    }
    const win = launch(id);
    paintDock();
    return win;
  }

  function sync() {
    const on = isPhone();
    applyClass(on);
    if (wm && wm.setPhone) wm.setPhone(on);
    if (!on) closeSheets();
    paintDock();
    paintSpace();
  }

  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", () => setTimeout(sync, 200));

  if (dock) {
    dock.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-phone]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.phone;
      if (id === "home") {
        if (sheetsOpen()) {
          closeSheets();
          paintDock();
          return;
        }
        if (!frontApp()) openRecents();
        else goHome();
        paintDock();
        return;
      }
      if (id === "torii") {
        closeSheets();
        if (openTorii) openTorii();
        return;
      }
      resumeOrLaunch(id);
    });
  }

  if (bar) {
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      goHome();
    });
  }

  if (recents) {
    recents.addEventListener("click", (e) => {
      e.stopPropagation();
      const closer = e.target.closest("[data-close]");
      if (closer && wm) {
        wm.close(Number(closer.dataset.close));
        openRecents();
        paintDock();
        return;
      }
      const splitter = e.target.closest("[data-split]");
      if (splitter && wm) {
        const pid = Number(splitter.dataset.split);
        if (splitPick && splitPick !== pid) {
          wm.split(splitPick, pid);
          splitPick = 0;
          closeSheets();
          paintDock();
          return;
        }
        splitPick = pid;
        track.querySelectorAll(".phone-card").forEach((c) => {
          c.classList.toggle("is-pick", Number(c.dataset.pid) === pid);
        });
        return;
      }
      const card = e.target.closest(".phone-card[data-pid]");
      if (card && wm) {
        const pid = Number(card.dataset.pid);
        closeSheets();
        wm.restore(pid);
        wm.focus(pid);
        paintDock();
      }
    });
  }

  if (shade) {
    shade.addEventListener("click", (e) => {
      e.stopPropagation();
      const row = e.target.closest(".phone-journal");
      if (row && row.dataset.path && openPath) {
        closeSheets();
        openPath(row.dataset.path);
        return;
      }
      const btn = e.target.closest("[data-shade]");
      if (!btn) return;
      const act = btn.dataset.shade;
      if (act === "ma") {
        closeSheets();
        kernel.maSleep();
        return;
      }
      if (act === "spaces") {
        closeSheets();
        if (openSpaces) openSpaces();
        return;
      }
      if (act === "kashiwa") {
        closeSheets();
        if (openKashiwa) openKashiwa();
        return;
      }
      if (act === "silent") {
        const on = !(kernel.state.settings && kernel.state.settings.silent);
        kernel.sysctl("ma.silent", on ? "1" : "0");
        btn.classList.toggle("is-on", on);
      }
    });
  }

  function bindOtoCmd(host) {
    if (!host) return;
    host.addEventListener("click", (e) => {
      const open = e.target.closest("#phone-now-open, #oto-pill");
      if (open) {
        e.stopPropagation();
        openNow();
        return;
      }
      const btn = e.target.closest("[data-oto]");
      if (!btn) return;
      e.stopPropagation();
      kernel.otoCmd(btn.dataset.oto);
    });
  }

  bindOtoCmd(nowBar);
  bindOtoCmd(shadeOto);
  bindOtoCmd(document.getElementById("oto-pill"));

  if (shadeHit) {
    shadeHit.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isPhone()) return;
      if (shade && !shade.hidden) closeSheets();
      else openShade();
    });
  }

  const spaceEl = document.getElementById("phone-space");
  if (spaceEl) {
    spaceEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!isPhone()) return;
      closeSheets();
      if (openSpaces) openSpaces();
    });
  }

  if (actions) {
    actions.addEventListener("click", async (e) => {
      e.stopPropagation();
      const btn = e.target.closest("button");
      if (!btn) return;
      const path = btn.dataset.path;
      const withId = btn.dataset.with;
      const act = btn.dataset.act;
      const shareTo = btn.dataset.share;
      if (shareTo && path) {
        closeSheets();
        sharePath(path, { to: shareTo });
        return;
      }
      if (withId && path && openPath) {
        closeSheets();
        openPath(path, { with: withId });
        return;
      }
      if (act === "open" && path && openPath) {
        closeSheets();
        openPath(path);
        return;
      }
      if (act === "stat" && path) {
        closeSheets();
        kernel.emit("stat", path);
        return;
      }
      if (act === "copy" && path) {
        kernel.clipPush(path);
        return;
      }
      if (act === "muen" && path) {
        try {
          await kernel.vfs.moveToMuen(path);
          kernel.emit("vfs");
        } catch (err) {
          kernel.log(`muen: ${err.message}`, "fs");
        }
        closeSheets();
      }
    });
  }

  bindHomeIcons(
    (path) => {
      closeSheets();
      if (openPath) openPath(path);
    },
    openActions
  );
  bindGestures({
    openTorii: () => {
      closeSheets();
      if (openTorii) openTorii();
    },
    openShade,
    openRecents,
    goHome,
    frontApp,
    paintDock,
    sheetsOpen,
    closeSheets,
  });

  paintSpace();
  paintShadeHit();
  paintOto();
  kernel.addEventListener("ps", paintDock);
  kernel.addEventListener("oshi", () => {
    paintShadeHit();
    if (shade && !shade.hidden) openShade();
  });
  kernel.addEventListener("oshi-read", paintShadeHit);
  kernel.addEventListener("journal", () => {
    if (shade && !shade.hidden) paintShadeJournal();
  });
  kernel.addEventListener("oto", paintOto);
  kernel.addEventListener("space", () => {
    paintDock();
    paintSpace();
  });
  document.getElementById("window-layer")?.addEventListener("click", paintDock);

  if (isPhone() && wm) {
    requestAnimationFrame(() => {
      goHome();
    });
  }

  return { isPhone, goHome, paintDock, openRecents, openShade, openActions, resumeOrLaunch };
}

function bindHomeIcons(openPath, openActions) {
  const icons = document.getElementById("desktop-icons");
  if (!icons) return;
  let hold = 0;
  let held = false;

  icons.addEventListener(
    "pointerdown",
    (e) => {
      if (!isPhone()) return;
      const btn = e.target.closest(".desk-icon");
      if (!btn) return;
      e.stopPropagation();
      held = false;
      if (hold) clearTimeout(hold);
      hold = setTimeout(() => {
        hold = 0;
        held = true;
        if (openActions) openActions(btn.dataset.path);
      }, 480);
    },
    true
  );

  const endHold = () => {
    if (hold) clearTimeout(hold);
    hold = 0;
    if (held) setTimeout(() => { held = false; }, 280);
  };
  icons.addEventListener("pointerup", endHold, true);
  icons.addEventListener("pointercancel", endHold, true);

  icons.addEventListener(
    "click",
    (e) => {
      if (!isPhone()) return;
      const btn = e.target.closest(".desk-icon");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (held) {
        held = false;
        return;
      }
      const path = btn.dataset.path;
      if (path && openPath) openPath(path);
    },
    true
  );
}

function bindGestures({ openTorii, openShade, openRecents, goHome, frontApp, paintDock, sheetsOpen, closeSheets }) {
  let mode = 0;
  let y0 = 0;
  let x0 = 0;
  let t0 = 0;

  document.addEventListener(
    "touchstart",
    (e) => {
      if (!isPhone()) return;
      const t = e.changedTouches[0];
      const y = t.clientY;
      const x = t.clientX;
      const h = window.innerHeight;
      if (y > h - 32) {
        mode = 1;
        y0 = y;
        x0 = x;
        t0 = Date.now();
      } else if (y < 40) {
        mode = 2;
        y0 = y;
        x0 = x;
        t0 = Date.now();
      } else mode = 0;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (!isPhone() || !mode) return;
      const t = e.changedTouches[0];
      const dy = y0 - t.clientY;
      const dx = Math.abs(t.clientX - x0);
      const held = Date.now() - t0 > 260;
      if (mode === 1 && dy > 44 && dx < 90) {
        if (sheetsOpen && sheetsOpen()) closeSheets();
        else if (held || dy > 130) openRecents();
        else goHome();
        paintDock();
      }
      if (mode === 2 && t.clientY - y0 > 44 && dx < 90) {
        if (frontApp()) openShade();
        else openTorii();
      }
      mode = 0;
    },
    { passive: true }
  );
}
