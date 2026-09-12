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

export function bindPhone({ kernel, wm, launch, openPath, openTorii, openOshi, openRecents, openSpaces }) {
  applyClass(isPhone());
  if (wm && wm.setPhone) wm.setPhone(isPhone());

  function sync() {
    const on = isPhone();
    applyClass(on);
    if (wm && wm.setPhone) wm.setPhone(on);
    paintDock();
  }

  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", () => setTimeout(sync, 200));

  const dock = document.getElementById("phone-dock");
  const bar = document.getElementById("phone-homebar");

  function frontApp() {
    if (!wm) return null;
    return (
      wm.list().find((w) => !w.minimized && !w.el.classList.contains("is-away") && !w.el.classList.contains("is-phone-back")) ||
      null
    );
  }

  function goHome() {
    if (!wm) return;
    wm.hideAll();
    document.getElementById("desktop")?.classList.remove("is-app");
    paintDock();
  }

  function paintDock() {
    if (!dock) return;
    const front = frontApp();
    dock.querySelectorAll("[data-phone]").forEach((btn) => {
      const id = btn.dataset.phone;
      btn.classList.toggle("is-on", front ? front.appId === id : id === "home");
    });
    document.getElementById("desktop")?.classList.toggle("is-app", !!front);
  }

  if (dock) {
    dock.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-phone]");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.dataset.phone;
      if (id === "home") {
        if (!frontApp()) {
          if (openRecents) openRecents();
        } else goHome();
        paintDock();
        return;
      }
      if (id === "torii") {
        if (openTorii) openTorii();
        return;
      }
      if (id === "spaces") {
        if (openSpaces) openSpaces();
        return;
      }
      launch(id);
      paintDock();
    });
  }

  if (bar) {
    bar.addEventListener("click", (e) => {
      e.stopPropagation();
      goHome();
    });
  }

  const clock = document.getElementById("clock");
  if (clock) {
    clock.addEventListener("click", () => {
      if (!isPhone()) return;
    });
  }

  bindHomeIcons(openPath);
  bindGestures({ openTorii, openOshi, openRecents, goHome, frontApp, paintDock });

  function paintSpace() {
    const el = document.getElementById("phone-space");
    if (el) el.textContent = kernel.spacePref().name;
  }
  paintSpace();
  kernel.addEventListener("ps", paintDock);
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

  return { isPhone, goHome, paintDock };
}

function bindHomeIcons(openPath) {
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
        btn.dispatchEvent(
          new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY })
        );
      }, 480);
    },
    true
  );

  const endHold = () => {
    if (hold) clearTimeout(hold);
    hold = 0;
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

function bindGestures({ openTorii, openOshi, openRecents, goHome, frontApp, paintDock }) {
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
        if (held || dy > 130) {
          if (openRecents) openRecents();
        } else {
          goHome();
        }
        paintDock();
      }
      if (mode === 2 && t.clientY - y0 > 44 && dx < 90) {
        if (frontApp()) {
          if (openOshi) openOshi();
        } else if (openTorii) openTorii();
      }
      mode = 0;
    },
    { passive: true }
  );
}
