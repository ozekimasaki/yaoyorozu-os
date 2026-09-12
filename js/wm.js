const INSET = { left: 12, top: 48, right: 12, bottom: 44 };

function geomOf(w) {
  return {
    appId: w.appId,
    space: w.space,
    pinned: !w.space,
    left: `${w.el.offsetLeft}px`,
    top: `${w.el.offsetTop}px`,
    width: `${w.el.offsetWidth}px`,
    height: w.shaded ? w.preShadeH || `${w.el.offsetHeight}px` : `${w.el.offsetHeight}px`,
    maximized: !!w.maximized,
    shaded: !!w.shaded,
    fore: !!w.fore,
  };
}

export function createWm(root, taskbar, kernel) {
  const windows = new Map();
  let z = 30;
  let zFore = 8000;
  let cascade = 0;
  let persistT = 0;
  let exposeSaved = null;

  function persistWindows() {
    kernel.vfs.metaSet(
      "windows",
      [...windows.values()].map((w) => {
        if (exposeSaved && exposeSaved.has(w.pid)) {
          const g = exposeSaved.get(w.pid);
          return {
            appId: w.appId,
            space: w.space,
            pinned: !w.space,
            left: g.left,
            top: g.top,
            width: g.width,
            height: g.shaded ? g.preShadeH || g.height : g.height,
            maximized: !!g.maximized,
            shaded: !!g.shaded,
            fore: !!w.fore,
          };
        }
        return geomOf(w);
      })
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
      const label = `${w.title} \u00b7 ${w.pid}`;
      let btn = host.querySelector(`[data-pid="${pid}"]`);
      if (!btn) {
        btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.pid = pid;
        btn.addEventListener("click", () => {
          const cur = windows.get(Number(btn.dataset.pid));
          if (!cur) return;
          if (exposeSaved) {
            endExpose(cur.pid);
            return;
          }
          if (cur.minimized) restore(cur.pid);
          else if (cur.el.classList.contains("focused")) minimize(cur.pid);
          else focus(cur.pid);
        });
        btn.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          showTaskMenu(e.clientX, e.clientY, Number(btn.dataset.pid));
        });
        btn.addEventListener("auxclick", (e) => {
          if (e.button !== 1) return;
          e.preventDefault();
          shade(Number(btn.dataset.pid));
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
    `<button type="button" data-act="min">\u3057\u307e\u3046</button>` +
    `<button type="button" data-act="pin">\u5168\u770c\u306b\u7d50\u3076</button>` +
    `<button type="button" data-act="prev">\u5de6\u306e\u770c\u3078</button>` +
    `<button type="button" data-act="next">\u53f3\u306e\u770c\u3078</button>` +
    `<button type="button" data-act="shade">\u5dfb\u304f</button>` +
    `<button type="button" data-act="center">\u4e2d\u592e\u3078</button>` +
    `<button type="button" data-act="top">\u4e0a\u3078\u5bc4\u305b\u308b</button>` +
    `<button type="button" data-act="bottom">\u4e0b\u3078\u5bc4\u305b\u308b</button>` +
    `<button type="button" data-act="fore">\u624b\u524d\u306b\u7d50\u3076</button>` +
    `<button type="button" data-act="close">\u9589\u3058\u308b</button>`;
  document.body.appendChild(taskMenu);
  let taskMenuPid = 0;
  function neighborSpace(dir) {
    const prefs = kernel.state.prefs || [];
    if (!prefs.length) return null;
    const i = prefs.findIndex((p) => p.id === kernel.state.currentSpace);
    const idx = i < 0 ? 0 : i;
    return prefs[(idx + dir + prefs.length) % prefs.length];
  }

  function sendSpace(pid, prefId) {
    const w = windows.get(pid);
    if (!w || !prefId) return;
    w.space = prefId;
    const btn = w.el.querySelector(".win-pin");
    if (btn) btn.classList.remove("is-on");
    applySpace(kernel.state.currentSpace);
    schedulePersist();
    const pref = kernel.state.prefs.find((p) => p.id === prefId);
    kernel.log(`\u7a93 ${pid} \u3092${pref ? pref.name : prefId}\u3078\u9001\u3063\u305f`, "wm");
  }

  function showTaskMenu(x, y, pid) {
    taskMenuPid = pid;
    const w = windows.get(pid);
    const pinBtn = taskMenu.querySelector("[data-act=pin]");
    if (pinBtn) pinBtn.textContent = w && !w.space ? "\u3053\u306e\u770c\u3078\u623b\u3059" : "\u5168\u770c\u306b\u7d50\u3076";
    const shadeBtn = taskMenu.querySelector("[data-act=shade]");
    if (shadeBtn) shadeBtn.textContent = w && w.shaded ? "\u5e83\u3052\u308b" : "\u5dfb\u304f";
    const foreBtn = taskMenu.querySelector("[data-act=fore]");
    if (foreBtn) foreBtn.textContent = w && w.fore ? "\u624b\u524d\u3092\u89e3\u304f" : "\u624b\u524d\u306b\u7d50\u3076";
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
    else if (act === "prev") {
      const p = neighborSpace(-1);
      if (p) sendSpace(pid, p.id);
    } else if (act === "next") {
      const p = neighborSpace(1);
      if (p) sendSpace(pid, p.id);
    }
    else if (act === "shade") shade(pid);
    else if (act === "center") center(pid);
    else if (act === "top") snapEdge(pid, "top");
    else if (act === "bottom") snapEdge(pid, "bottom");
    else if (act === "fore") raise(pid);
    else if (act === "close") close(pid);
  });
  document.addEventListener("click", () => {
    taskMenu.hidden = true;
  });
  function overlayBlocks() {
    return (
      document.getElementById("torii-gate")?.classList.contains("open") ||
      document.getElementById("kashiwa-stage")?.classList.contains("open") ||
      document.getElementById("win-switcher")?.classList.contains("open") ||
      document.getElementById("space-switcher")?.classList.contains("open") ||
      (document.getElementById("recent-list") && !document.getElementById("recent-list").hidden) ||
      (document.getElementById("keymap") && !document.getElementById("keymap").hidden)
    );
  }

  document.addEventListener("keydown", (e) => {
    const sameApp =
      (e.shiftKey && (e.code === "Backslash" || e.key === "\\" || e.key === "|")) ||
      ((e.ctrlKey || e.metaKey) && (e.code === "Backquote" || e.key === "`"));
    if (sameApp) {
      e.preventDefault();
      e.stopPropagation();
      cycleApp();
      return;
    }
    const tag = (e.target && e.target.tagName) || "";
    const typing = tag === "INPUT" || tag === "TEXTAREA";
    if (exposeSaved) {
      if (e.key === "Escape") {
        e.preventDefault();
        endExpose();
        return;
      }
      if (e.key === "Enter" && !typing) {
        const cur = [...windows.values()].find(
          (x) => x.el.classList.contains("focused") && !x.minimized && !x.el.classList.contains("is-away")
        );
        e.preventDefault();
        endExpose(cur ? cur.pid : undefined);
        return;
      }
      if (e.key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
        e.preventDefault();
        endExpose();
        return;
      }
    } else if (e.key === "e" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing) {
      if (document.activeElement && document.activeElement.classList.contains("desk-icon")) return;
      if (overlayBlocks()) return;
      e.preventDefault();
      expose();
      return;
    }
    if (typing) return;
    if (document.activeElement && document.activeElement.classList.contains("desk-icon")) return;
    if (!e.shiftKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    const w = [...windows.values()].find(
      (x) => x.el.classList.contains("focused") && !x.minimized && !x.el.classList.contains("is-away")
    );
    if (!w) return;
    e.preventDefault();
    snapEdge(w.pid, e.key === "ArrowUp" ? "top" : "bottom");
  });

  function snapEdge(pid, side) {
    if (exposeSaved) endExpose(pid);
    const w = windows.get(pid);
    if (!w || w.maximized) return;
    if (w.shaded) {
      w.shaded = false;
      w.el.classList.remove("is-shade");
      w.el.style.height = w.preShadeH || w.el.style.height;
    }
    w.el.classList.remove("is-max");
    if (side === "left") {
      w.el.style.left = `${INSET.left}px`;
      w.el.style.top = `${INSET.top}px`;
      w.el.style.width = `calc(50% - ${INSET.left + 6}px)`;
      w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
      kernel.log("\u7a93\u3092\u5de6\u306e\u4f59\u767d\u3078\u5bc4\u305b\u305f", "wm");
    } else if (side === "right") {
      w.el.style.left = `calc(50% + 6px)`;
      w.el.style.top = `${INSET.top}px`;
      w.el.style.width = `calc(50% - ${INSET.right + 6}px)`;
      w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
      kernel.log("\u7a93\u3092\u53f3\u306e\u4f59\u767d\u3078\u5bc4\u305b\u305f", "wm");
    } else if (side === "top") {
      w.el.style.left = `${INSET.left}px`;
      w.el.style.top = `${INSET.top}px`;
      w.el.style.width = `calc(100% - ${INSET.left + INSET.right}px)`;
      w.el.style.height = `calc(50% - ${INSET.top / 2 + 8}px)`;
      kernel.log("\u7a93\u3092\u4e0a\u306e\u4f59\u767d\u3078\u5bc4\u305b\u305f", "wm");
    } else if (side === "bottom") {
      w.el.style.left = `${INSET.left}px`;
      w.el.style.top = `calc(50% + 4px)`;
      w.el.style.width = `calc(100% - ${INSET.left + INSET.right}px)`;
      w.el.style.height = `calc(50% - ${INSET.bottom / 2 + 12}px)`;
      kernel.log("\u7a93\u3092\u4e0b\u306e\u4f59\u767d\u3078\u5bc4\u305b\u305f", "wm");
    }
    schedulePersist();
  }

  function visibleWins() {
    return [...windows.values()].filter((w) => !w.minimized && !w.el.classList.contains("is-away"));
  }

  function layoutGrid(vis, persist) {
    const n = vis.length;
    if (!n) return 0;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const availW = window.innerWidth - INSET.left - INSET.right;
    const availH = window.innerHeight - INSET.top - INSET.bottom;
    const cw = availW / cols;
    const rh = availH / rows;
    vis.forEach((w, i) => {
      w.maximized = false;
      w.shaded = false;
      w.el.classList.remove("is-max", "is-shade");
      const c = i % cols;
      const r = (i / cols) | 0;
      w.el.style.left = `${INSET.left + c * cw}px`;
      w.el.style.top = `${INSET.top + r * rh}px`;
      w.el.style.width = `${Math.max(240, cw - 16)}px`;
      w.el.style.height = `${Math.max(160, rh - 16)}px`;
    });
    if (persist) schedulePersist();
    return n;
  }

  function isExpose() {
    return !!exposeSaved;
  }

  function expose() {
    if (exposeSaved) {
      endExpose();
      return false;
    }
    const vis = visibleWins();
    if (!vis.length) return false;
    exposeSaved = new Map();
    for (const w of vis) {
      exposeSaved.set(w.pid, {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
        maximized: !!w.maximized,
        shaded: !!w.shaded,
        preShadeH: w.preShadeH,
        prev: w.prev ? { ...w.prev } : null,
      });
    }
    layoutGrid(vis, false);
    root.classList.add("is-expose");
    document.getElementById("desktop")?.classList.add("is-expose");
    kernel.log(`\u4fef\u77b0 ${vis.length}`, "wm");
    return true;
  }

  function restoreExposeGeom(w, saved) {
    if (!saved) return;
    w.maximized = saved.maximized;
    w.shaded = saved.shaded;
    w.preShadeH = saved.preShadeH;
    w.prev = saved.prev;
    w.el.classList.toggle("is-max", w.maximized);
    w.el.classList.toggle("is-shade", w.shaded);
    if (w.maximized) {
      w.el.style.left = `${INSET.left}px`;
      w.el.style.top = `${INSET.top}px`;
      w.el.style.width = `calc(100% - ${INSET.left + INSET.right}px)`;
      w.el.style.height = `calc(100% - ${INSET.top + INSET.bottom}px)`;
      return;
    }
    w.el.style.left = saved.left;
    w.el.style.top = saved.top;
    w.el.style.width = saved.width;
    w.el.style.height = w.shaded ? "36px" : saved.height;
  }

  function endExpose(pid) {
    if (!exposeSaved) return false;
    const saved = exposeSaved;
    exposeSaved = null;
    root.classList.remove("is-expose");
    document.getElementById("desktop")?.classList.remove("is-expose");
    for (const w of windows.values()) {
      const g = saved.get(w.pid);
      if (g) restoreExposeGeom(w, g);
    }
    if (pid) {
      restore(pid);
      focus(pid);
    }
    return true;
  }

  function tile() {
    if (exposeSaved) endExpose();
    const vis = visibleWins();
    const n = layoutGrid(vis, true);
    if (n) kernel.log(`\u7a93\u3092${n}\u5e2d\u306b\u4e26\u3079\u305f`, "wm");
    return n;
  }

  function applySpace(spaceId) {
    if (exposeSaved) endExpose();
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
    if (w.fore) {
      zFore += 1;
      w.el.style.zIndex = String(zFore);
    } else {
      z += 1;
      w.el.style.zIndex = String(z);
    }
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
    if (exposeSaved) endExpose();
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
    kernel.log(w.space ? `\u7a93 ${w.pid} \u3092\u3053\u306e\u770c\u3078\u623b\u3057\u305f` : `\u7a93 ${w.pid} \u3092\u5168\u770c\u306b\u7d50\u3093\u3060`, "wm");
  }

  function raise(pid) {
    const w = windows.get(pid);
    if (!w) return;
    w.fore = !w.fore;
    w.el.classList.toggle("is-fore", w.fore);
    if (!w.fore) {
      z += 1;
      w.el.style.zIndex = String(z);
    }
    focus(pid);
    schedulePersist();
    kernel.log(w.fore ? `\u7a93 ${pid} \u3092\u624b\u524d\u306b\u7d50\u3093\u3060` : `\u7a93 ${pid} \u306e\u624b\u524d\u3092\u89e3\u3044\u305f`, "wm");
  }

  function center(pid) {
    const w = windows.get(pid);
    if (!w || w.maximized) return;
    if (w.shaded) {
      w.shaded = false;
      w.el.classList.remove("is-shade");
      w.el.style.height = w.preShadeH || w.el.style.height;
    }
    const width = w.el.offsetWidth;
    const height = w.el.offsetHeight;
    const left = Math.max(INSET.left, Math.round((window.innerWidth - width) / 2));
    const top = Math.max(INSET.top, Math.round((window.innerHeight - height - INSET.bottom) / 2));
    w.el.style.left = `${left}px`;
    w.el.style.top = `${top}px`;
    schedulePersist();
    kernel.log(`\u7a93 ${pid} \u3092\u4e2d\u592e\u3078\u5bc4\u305b\u305f`, "wm");
  }

  function shade(pid) {
    const w = windows.get(pid);
    if (!w || w.maximized) return;
    w.shaded = !w.shaded;
    if (w.shaded) {
      w.preShadeH = w.el.style.height || `${w.el.offsetHeight}px`;
      w.el.style.height = "36px";
      w.el.classList.add("is-shade");
      kernel.log(`\u7a93 ${pid} \u3092\u5dfb\u3044\u305f`, "wm");
    } else {
      w.el.classList.remove("is-shade");
      w.el.style.height = w.preShadeH || "min(520px, 72vh)";
      kernel.log(`\u7a93 ${pid} \u3092\u5e83\u3052\u305f`, "wm");
    }
    schedulePersist();
  }

  function maximize(pid) {
    if (exposeSaved) endExpose(pid);
    const w = windows.get(pid);
    if (!w) return;
    if (w.shaded) {
      w.shaded = false;
      w.el.classList.remove("is-shade");
      w.el.style.height = w.preShadeH || w.el.style.height;
    }
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
    if (exposeSaved) endExpose();
    const w = windows.get(pid);
    if (!w) return;
    const lastInSpace =
      !!w.space &&
      [...windows.values()].filter((x) => x.space === w.space && x.pid !== pid).length === 0;
    if (lastInSpace && !w.zashikiOnce) {
      w.zashikiOnce = true;
      kernel.log("\u5ea7\u6577\u7ae5: \u3053\u306e\u7a7a\u9593\u306e\u6700\u5f8c\u306e\u7a93\u3092\u3001\u4e00\u5ea6\u6b62\u3081\u305f", "proc");
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
      if (exposeSaved) {
        e.preventDefault();
        e.stopPropagation();
        endExpose(w.pid);
        return;
      }
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
    bar.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      shade(w.pid);
    });
    bar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      showTaskMenu(e.clientX, e.clientY, w.pid);
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
        snapEdge(w.pid, "left");
      } else if (x > vw - edge) {
        snapEdge(w.pid, "right");
      } else if (y >= vh - 48) {
        snapEdge(w.pid, "bottom");
      }
      schedulePersist();
    });
  }

  function bindResize(w) {
    w.el.querySelectorAll("[data-rz]").forEach((handle) => {
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (exposeSaved) {
          endExpose(w.pid);
          return;
        }
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
          if (w.maximized || w.shaded) return;
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

  function create({ appId, title, pid, space, width, height, geom, mount, onClose, onFocus, onDrop }) {
    if (exposeSaved) endExpose();
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
        <button class="win-pin" type="button" aria-label="\u5168\u770c\u306b\u7d50\u3076"></button>
        <button class="win-close" type="button" aria-label="\u9589\u3058\u308b"></button>
        <button class="win-min" type="button" aria-label="\u6700\u5c0f\u5316"></button>
        <button class="win-max" type="button" aria-label="\u6700\u5927\u5316"></button>
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
      shaded: false,
      fore: !!(geom && geom.fore),
      preShadeH: "",
      zashikiOnce: false,
      onClose,
      onFocus,
      onDrop,
    };
    windows.set(pid, w);
    bindDrag(w);
    bindResize(w);
    el.addEventListener("mousedown", (e) => {
      if (exposeSaved) {
        e.stopPropagation();
        endExpose(pid);
        return;
      }
      focus(pid);
    });
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
    else if (geom && geom.shaded) {
      w.shaded = true;
      w.preShadeH = geom.height || `${w.el.offsetHeight}px`;
      w.el.classList.add("is-shade");
      w.el.style.height = "36px";
    }
    if (w.fore) {
      w.el.classList.add("is-fore");
      zFore += 1;
      w.el.style.zIndex = String(zFore);
    }
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

  function cycleApp() {
    const focused = [...windows.values()].find(
      (w) => w.el.classList.contains("focused") && !w.minimized && !w.el.classList.contains("is-away")
    );
    if (!focused) {
      cycle();
      return;
    }
    const same = [...windows.values()].filter(
      (w) => w.appId === focused.appId && !w.el.classList.contains("is-away")
    );
    if (same.length < 2) {
      cycle();
      return;
    }
    const i = same.findIndex((w) => w.pid === focused.pid);
    const next = same[(i + 1) % same.length];
    restore(next.pid);
    focus(next.pid);
    kernel.log(`\u540c\u3058\u30a2\u30d7\u30ea\u306e\u7a93 ${next.pid}`, "wm");
  }

  function list() {
    return [...windows.values()];
  }

  function setTitle(pid, title) {
    const w = windows.get(pid);
    if (!w || w.title === title) return;
    w.title = title;
    const span = w.el.querySelector(".titlebar span");
    if (span && span.textContent !== title) span.textContent = title;
    taskButtons();
  }

  kernel.addEventListener("space", () => applySpace(kernel.state.currentSpace));
  const deskHost = document.getElementById("desktop");
  if (deskHost) {
    deskHost.addEventListener(
      "mousedown",
      (e) => {
        if (!exposeSaved) return;
        if (e.target.closest(".window")) return;
        if (e.target.closest(".taskbar") || e.target.closest(".menubar")) return;
        if (e.target.closest("#task-menu") || e.target.closest("#eaves-menu")) return;
        endExpose();
      },
      true
    );
  }

  return {
    create,
    close,
    minimize,
    maximize,
    restore,
    focus,
    cycle,
    cycleApp,
    applySpace,
    list,
    setTitle,
    taskButtons,
    persistWindows,
    geomOf,
    hideAll,
    pin,
    tile,
    snapEdge,
    sendSpace,
    neighborSpace,
    shade,
    center,
    raise,
    expose,
    endExpose,
    isExpose,
  };
}
