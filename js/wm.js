const INSET = { left: 12, top: 48, right: 12, bottom: 44 };

function geomOf(w) {
  return {
    appId: w.appId,
    space: w.space,
    pinned: !w.space,
    left: `${w.el.offsetLeft}px`,
    top: `${w.el.offsetTop}px`,
    width: `${w.el.offsetWidth}px`,
    height: `${w.el.offsetHeight}px`,
    maximized: !!w.maximized,
  };
}

export function createWm(root, taskbar, kernel) {
  const windows = new Map();
  let z = 30;
  let cascade = 0;
  let persistT = 0;

  function persistWindows() {
    kernel.vfs.metaSet(
      "windows",
      [...windows.values()].map((w) => geomOf(w))
    );
  }

  function schedulePersist() {
    if (persistT) clearTimeout(persistT);
    persistT = setTimeout(() => {
      persistT = 0;
      persistWindows();
    }, 280);
  }

  function taskButtons() {
    if (!taskbar) return;
    const host = taskbar.querySelector(".task-apps") || taskbar;
    const seen = new Set();
    for (const w of windows.values()) {
      const pid = String(w.pid);
      seen.add(pid);
      const cls = `task-app${w.el.classList.contains("focused") ? " is-focus" : ""}${w.minimized ? " is-min" : ""}`;
      const label = `${w.title} · ${w.pid}`;
      let btn = host.querySelector(`[data-pid="${pid}"]`);
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.pid = pid;
        btn.addEventListener("click", () => {
          const cur = windows.get(Number(btn.dataset.pid));
          if (!cur) return;
          if (cur.minimized) restore(cur.pid);
          else if (cur.el.classList.contains("focused")) minimize(cur.pid);
          else focus(cur.pid);
        });
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showTaskMenu(e.clientX, e.clientY, Number(btn.dataset.pid));
        });
        host.appendChild(btn);
      }
      if (btn.className !== cls) btn.className = cls;
      if (btn.textContent !== label) btn.textContent = label;
    }
    host.querySelectorAll("[data-pid]").forEach((el) => {
      if (!seen.has(el.dataset.pid)) el.remove();
    });
  }

  const taskMenu = document.createElement("div");
  taskMenu.id = "task-menu";
  taskMenu.hidden = true;
  taskMenu.innerHTML =
    `<button type="button" data-act="min">しまう</button>` +
    `<button type="button" data-act="pin">全県に結ぶ</button>` +
    `<button type="button" data-act="close">閉じる</button>`;
  document.body.appendChild(taskMenu);
  let taskMenuPid = 0;
  function showTaskMenu(x, y, pid) {
    taskMenuPid = pid;
    taskMenu.style.left = `${x}px`;
    taskMenu.style.top = `${y}px`;
    taskMenu.hidden = false;
  }
  taskMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    const act = e.target.dataset.act;
    const pid = taskMenuPid;
    taskMenu.hidden = true;
    if (!act || !pid) return;
    if (act === "min") minimize(pid);
    else if (act === "pin") pin(pid);
    else if (act === "close") close(pid);
  });
  document.addEventListener("click", () => {
    taskMenu.hidden = true;
  });

  function tile() {
    const vis = [...windows.values()].filter((w) => !w.minimized && !w.el.classList.contains("is-away"));
    if (!vis.length) return 0;
    const n = vis.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const availW = window.innerWidth - INSET.left - INSET.right;
    const availH = window.innerHeight - INSET.top - INSET.bottom;
    const cw = availW / cols;
    const rh = availH / rows;
    vis.forEach((w, i) => {
      w.maximized = false;
      w.el.classList.remove("is-max");
      const c = i % cols;
      const r = (i / cols) | 0;
      w.el.style.left = `${INSET.left + c * cw}px`;
      w.el.style.top = `${INSET.top + r * rh}px`;
      w.el.style.width = `${Math.max(320, cw - 8)}px`;
      w.el.style.height = `${Math.max(220, rh - 8)}px`;
    });
    schedulePersist();
    kernel.log(`窓を${n}席に並べた`, "wm");
    return n;
  }

  function applySpace(spaceId) {
    let first = null;
    for (const w of windows.values()) {
      const here = !w.space || w.space === spaceId;
      w.el.classList.toggle("is-away", !here);
      if (!here) w.el.classList.remove("focused");
      else if (!first && !w.minimized) first = w;
    }
    if (first) focus(first.pid);
    else taskButtons();
  }

  function focus(pid) {
    const w = windows.get(pid);
    if (!w || w.minimized || w.el.classList.contains("is-away")) return;
    for (const other of windows.values()) other.el.classList.remove("focused");
    z += 1;
    w.el.style.zIndex = String(z);
    w.el.classList.add("focused");
    if (w.onFocus) w.onFocus();
    taskButtons();
  }

  function minimize(pid, quiet = false) {
    const w = windows.get(pid);
    if (!w) return;
    w.minimized = true;
    w.el.classList.add("is-min");
    w.el.classList.remove("focused");
    if (!quiet) taskButtons();
  }

  function restore(pid, quiet = false) {
    const w = windows.get(pid);
    if (!w) return;
    w.minimized = false;
    w.el.classList.remove("is-min");
    if (quiet) return;
    focus(pid);
  }

  let deskHidden = null;

  function hideAll() {
    if (deskHidden) {
      for (const pid of deskHidden) restore(pid, true);
      const last = deskHidden[deskHidden.length - 1];
      deskHidden = null;
      if (last) focus(last);
      else taskButtons();
      return true;
    }
    const ids = [];
    for (const w of windows.values()) {
      if (!w.minimized && !w.el.classList.contains("is-away")) {
        ids.push(w.pid);
        minimize(w.pid, true);
      }
    }
    if (!ids.length) return false;
    deskHidden = ids;
    const desk = document.getElementById("desktop");
    if (desk) desk.focus();
    taskButtons();
    return true;
  }

  function pin(pid) {
    const w = windows.get(pid);
    if (!w) return;
    if (w.space) w.space = null;
    else w.space = kernel.state.currentSpace;
    const btn = w.el.querySelector(".win-pin");
    if (btn) btn.classList.toggle("is-on", !w.space);
    applySpace(kernel.state.currentSpace);
    schedulePersist();
    kernel.log(w.space ? `窓 ${w.pid} をこの県へ戻した` : `窓 ${w.pid} を全県に結んだ`, "wm");
  }

  function maximize(pid) {
    const w = windows.get(pid);
    if (!w) return;
    w.maximized = !w.maximized;
    if (w.maximized) {
      w.prev = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
      };
      w.el.style.left = `${INSET.left}px`;
      w.el.style.top = `${INSET.top}px`;
      w.el.style.width = `calc(100% - ${INSET.left + INSET.right}px)`;
      w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
      w.el.classList.add("is-max");
    } else if (w.prev) {
      w.el.style.left = w.prev.left;
      w.el.style.top = w.prev.top;
      w.el.style.width = w.prev.width;
      w.el.style.height = w.prev.height;
      w.el.classList.remove("is-max");
    }
    focus(pid);
    schedulePersist();
  }

  function close(pid) {
    const w = windows.get(pid);
    if (!w) return;
    const lastInSpace =
      !!w.space &&
      [...windows.values()].filter((x) => x.space === w.space && x.pid !== pid).length === 0;
    if (lastInSpace && !w.zashikiOnce) {
      w.zashikiOnce = true;
      kernel.log("座敷童: この空間の最後の窓を、一度止めた", "proc");
      kernel.emit("irq", { kind: "zashiki", pid });
      return false;
    }
    if (w.onClose) {
      const allow = w.onClose();
      if (allow === false) return false;
    }
    kernel.exitApp(w.pid);
    w.el.remove();
    windows.delete(pid);
    taskButtons();
    schedulePersist();
    return true;
  }

  function bindDrag(w) {
    const bar = w.el.querySelector(".titlebar");
    let dragging = false;
    let ox = 0;
    let oy = 0;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      focus(w.pid);
      ox = e.clientX - w.el.offsetLeft;
      oy = e.clientY - w.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging || w.maximized) return;
      w.el.style.left = `${Math.max(0, e.clientX - ox)}px`;
      w.el.style.top = `${Math.max(42, e.clientY - oy)}px`;
    });
    bar.addEventListener("pointerup", (e) => {
      dragging = false;
      if (w.maximized) return;
      const edge = 28;
      const x = e.clientX;
      const y = e.clientY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      if (y < 50) {
        maximize(w.pid);
        return;
      }
      if (x < edge) {
        w.el.style.left = `${INSET.left}px`;
        w.el.style.top = `${INSET.top}px`;
        w.el.style.width = `calc(50% - ${INSET.left + 6}px)`;
        w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
        kernel.log("窓を左の余白へ寄せた", "wm");
      } else if (x > vw - edge) {
        w.el.style.left = `calc(50% + 6px)`;
        w.el.style.top = `${INSET.top}px`;
        w.el.style.width = `calc(50% - ${INSET.right + 6}px)`;
        w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
        kernel.log("窓を右の余白へ寄せた", "wm");
      } else if (y > vh - 40) {
        minimize(w.pid);
      }
      schedulePersist();
    });
  }

  function bindResize(w) {
    w.el.querySelectorAll("[data-rz]").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        focus(w.pid);
        const dir = handle.dataset.rz;
        const start = {
          x: e.clientX,
          y: e.clientY,
          left: w.el.offsetLeft,
          top: w.el.offsetTop,
          w: w.el.offsetWidth,
          h: w.el.offsetHeight,
        };
        const move = (ev) => {
          if (w.maximized) return;
          const dx = ev.clientX - start.x;
          const dy = ev.clientY - start.y;
          let left = start.left;
          let top = start.top;
          let width = start.w;
          let height = start.h;
          if (dir.includes("e")) width = Math.max(320, start.w + dx);
          if (dir.includes("s")) height = Math.max(220, start.h + dy);
          if (dir.includes("w")) {
            width = Math.max(320, start.w - dx);
            left = start.left + (start.w - width);
          }
          if (dir.includes("n")) {
            height = Math.max(220, start.h - dy);
            top = start.top + (start.h - height);
          }
          w.el.style.left = `${left}px`;
          w.el.style.top = `${Math.max(42, top)}px`;
          w.el.style.width = `${width}px`;
          w.el.style.height = `${height}px`;
        };
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          schedulePersist();
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });
  }

  function create({ appId, title, pid, space, width, height, geom, mount, onClose, onFocus }) {
    const el = document.createElement("section");
    el.className = "window focused";
    el.dataset.app = appId;
    el.dataset.pid = String(pid);
    const left = 72 + (cascade % 7) * 28;
    const top = 64 + (cascade % 5) * 24;
    cascade += 1;
    if (geom && geom.left && geom.top && !geom.maximized) {
      el.style.left = geom.left;
      el.style.top = geom.top;
      el.style.width = geom.width || width || "min(720px, 82vw)";
      el.style.height = geom.height || height || "min(520px, 72vh)";
    } else {
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = width || "min(720px, 82vw)";
      el.style.height = height || "min(520px, 72vh)";
    }
    el.innerHTML = `
      <div class="titlebar"><span></span><div class="win-btns">
        <button class="win-pin" type="button" aria-label="全県に結ぶ"></button>
        <button class="win-close" type="button" aria-label="閉じる"></button>
        <button class="win-min" type="button" aria-label="最小化"></button>
        <button class="win-max" type="button" aria-label="最大化"></button>
      </div></div>
      <div class="win-body"></div>
      <div class="rz n" data-rz="n"></div>
      <div class="rz s" data-rz="s"></div>
      <div class="rz e" data-rz="e"></div>
      <div class="rz w" data-rz="w"></div>
      <div class="rz ne" data-rz="ne"></div>
      <div class="rz nw" data-rz="nw"></div>
      <div class="rz se" data-rz="se"></div>
      <div class="rz sw" data-rz="sw"></div>
    `;
    el.querySelector(".titlebar span").textContent = title;
    const body = el.querySelector(".win-body");
    if (mount) body.appendChild(mount);
    if (appId === "map") body.classList.add("map-body");
    root.appendChild(el);
    const w = {
      el,
      pid,
      appId,
      title,
      space: geom && geom.pinned ? null : space || kernel.state.currentSpace,
      minimized: false,
      maximized: false,
      zashikiOnce: false,
      onClose,
      onFocus,
    };
    windows.set(pid, w);
    bindDrag(w);
    bindResize(w);
    el.addEventListener("mousedown", () => focus(pid));
    if (w.space == null) el.querySelector(".win-pin").classList.add("is-on");
    el.querySelector(".win-close").addEventListener("click", () => close(pid));
    el.querySelector(".win-min").addEventListener("click", () => minimize(pid));
    el.querySelector(".win-max").addEventListener("click", () => maximize(pid));
    el.querySelector(".win-pin").addEventListener("click", (e) => {
      e.stopPropagation();
      pin(pid);
    });
    focus(pid);
    applySpace(kernel.state.currentSpace);
    if (geom && geom.maximized) maximize(pid);
    schedulePersist();
    return w;
  }

  function cycle() {
    const visible = [...windows.values()].filter((w) => !w.minimized && !w.el.classList.contains("is-away"));
    if (!visible.length) return;
    const i = visible.findIndex((w) => w.el.classList.contains("focused"));
    const next = visible[(i + 1) % visible.length];
    focus(next.pid);
  }

  function list() {
    return [...windows.values()];
  }

  function setTitle(pid, title) {
    const w = windows.get(pid);
    if (!w) return;
    w.title = title;
    const span = w.el.querySelector(".titlebar span");
    if (span) span.textContent = title;
    taskButtons();
  }

  kernel.addEventListener("space", () => applySpace(kernel.state.currentSpace));

  return {
    create,
    close,
    minimize,
    maximize,
    restore,
    focus,
    cycle,
    applySpace,
    list,
    setTitle,
    taskButtons,
    persistWindows,
    geomOf,
    hideAll,
    pin,
    tile,
  };
}
