function typeJump(list, cur, ch, state) {
  if (state.t) clearTimeout(state.t);
  state.q += ch;
  state.t = setTimeout(() => {
    state.q = "";
    state.t = 0;
  }, 800);
  const needle = state.q.toLowerCase();
  const n = list.length;
  if (!n) return cur;
  const start = Math.max(0, cur);
  for (let i = 1; i <= n; i += 1) {
    const item = list[(start + i) % n];
    if ((item.keys || "").toLowerCase().split("|").some((k) => k.startsWith(needle))) return (start + i) % n;
  }
  return cur;
}

function escAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function hold(e) {
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function isJumpKey(e) {
  if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return false;
  if ("';r/?[],.\\".includes(e.key)) return false;
  if (e.key === "；" || e.key === "’" || e.key === "、" || e.key === "。") return false;
  return true;
}

export function bindSwitchers({ kernel, getWm, openPath }) {
  const winEl = document.getElementById("win-switcher");
  const spaceEl = document.getElementById("space-switcher");
  const recentEl = document.getElementById("recent-list");
  const recentLog = document.getElementById("recent-log");

  let winIndex = 0;
  let lastWinSig = "";
  let spacePick = "";
  let lastSpaceSig = "";
  let recentPick = 0;
  let lastRecentSig = "";
  const winType = { q: "", t: 0 };
  const spaceType = { q: "", t: 0 };
  const recentType = { q: "", t: 0 };

  function closeWin() {
    if (winEl) winEl.classList.remove("open");
  }
  function closeSpaces() {
    if (spaceEl) spaceEl.classList.remove("open");
  }
  function closeRecent() {
    if (recentEl) recentEl.hidden = true;
  }
  function closeAll() {
    closeWin();
    closeSpaces();
    closeRecent();
  }

  function winRows() {
    const wm = getWm();
    return wm ? wm.list().filter((w) => !w.el.classList.contains("is-away")) : [];
  }

  function paintWinPick() {
    if (!winEl) return;
    winEl.querySelectorAll("[data-pid]").forEach((btn, i) => {
      btn.classList.toggle("is-on", i === winIndex);
    });
    winEl.querySelector("button.is-on")?.focus();
  }

  function paintWin(keepIndex) {
    if (!winEl) return;
    const wins = winRows();
    if (!wins.length) {
      lastWinSig = "";
      winEl.innerHTML = `<p class="muted">走っている窓はない。鳥居をくぐれ。</p>`;
      winEl.classList.add("open");
      return;
    }
    if (!keepIndex) {
      const fi = wins.findIndex((w) => w.el.classList.contains("focused"));
      winIndex = fi >= 0 ? fi : 0;
    }
    if (winIndex >= wins.length) winIndex = 0;
    if (winIndex < 0) winIndex = wins.length - 1;
    const sig = wins.map((w) => `${w.pid}:${w.title}:${w.appId}`).join("|");
    if (sig !== lastWinSig || !winEl.querySelector("[data-pid]")) {
      lastWinSig = sig;
      winEl.innerHTML = wins
        .map(
          (w, i) =>
            `<button type="button" class="${i === winIndex ? "is-on" : ""}" data-pid="${w.pid}" data-keys="${escAttr(w.title)}|${escAttr(w.appId)}">${escAttr(w.title)}<small>${escAttr(w.appId)} · ${w.pid}</small></button>`
        )
        .join("");
    }
    winEl.classList.add("open");
    paintWinPick();
  }

  function activateWin() {
    const btn = winEl && winEl.querySelector("button.is-on[data-pid]");
    const wm = getWm();
    if (btn && wm) {
      const pid = Number(btn.dataset.pid);
      wm.restore(pid);
      wm.focus(pid);
    }
    closeWin();
  }

  function paintSpacePick() {
    if (!spaceEl) return;
    const here = kernel.state.currentSpace;
    spaceEl.querySelectorAll("[data-id]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.id === spacePick);
      btn.classList.toggle("is-here", btn.dataset.id === here);
    });
    spaceEl.querySelector("[data-id].is-on")?.scrollIntoView({ block: "nearest" });
  }

  function paintSpaces() {
    if (!spaceEl) return;
    const prefs = kernel.state.prefs || [];
    const sig = prefs.map((p) => `${p.id}:${p.unusedCpu}:${p.season}`).join("|");
    if (sig !== lastSpaceSig || !spaceEl.querySelector("[data-id]")) {
      lastSpaceSig = sig;
      spaceEl.innerHTML = prefs
        .map(
          (p) =>
            `<button type="button" data-id="${escAttr(p.id)}" data-name="${escAttr(p.name)}">${escAttr(p.name)}<small>未使用CPU ${p.unusedCpu}% · ${escAttr(p.season)}</small></button>`
        )
        .join("");
    }
    if (!spacePick || !prefs.some((p) => p.id === spacePick)) spacePick = kernel.state.currentSpace;
    spaceEl.classList.add("open");
    paintSpacePick();
  }

  function enterSpace() {
    if (spacePick) kernel.setSpace(spacePick);
    closeSpaces();
  }

  function paintRecentPick() {
    if (!recentLog) return;
    recentLog.querySelectorAll("[data-path]").forEach((btn, i) => {
      btn.classList.toggle("is-on", i === recentPick);
    });
    recentLog.querySelector("[data-path].is-on")?.scrollIntoView({ block: "nearest" });
  }

  function paintRecent() {
    if (!recentLog) return;
    const rows = kernel.state.recent || [];
    const sig = rows.map((r) => r.path).join("\n");
    if (sig !== lastRecentSig || !recentLog.childNodes.length) {
      lastRecentSig = sig;
      recentLog.replaceChildren();
      if (!rows.length) {
        const p = document.createElement("p");
        p.className = "muted";
        p.textContent = "（まだ札はない）";
        recentLog.appendChild(p);
      } else {
        for (const r of rows) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.dataset.path = r.path;
          btn.dataset.name = r.path.split("/").pop() || r.path;
          btn.textContent = r.path;
          recentLog.appendChild(btn);
        }
      }
    }
    const n = recentLog.querySelectorAll("[data-path]").length;
    if (recentPick >= n) recentPick = Math.max(0, n - 1);
    paintRecentPick();
  }

  function enterRecent() {
    const btn = recentLog && recentLog.querySelector("[data-path].is-on");
    if (!btn) return;
    closeRecent();
    openPath(btn.dataset.path);
  }

  function toggleWin() {
    if (!winEl) return;
    if (winEl.classList.contains("open")) closeWin();
    else {
      closeSpaces();
      closeRecent();
      paintWin(false);
    }
  }

  function toggleSpaces() {
    if (!spaceEl) return;
    if (spaceEl.classList.contains("open")) closeSpaces();
    else {
      closeWin();
      closeRecent();
      paintSpaces();
    }
  }

  function toggleRecent() {
    if (!recentEl) return;
    const open = recentEl.hidden;
    if (open) {
      closeWin();
      closeSpaces();
      recentEl.hidden = false;
      paintRecent();
    } else closeRecent();
  }

  if (winEl) {
    winEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.target.closest("[data-pid]");
      if (!btn) return;
      const wm = getWm();
      if (wm) {
        wm.restore(Number(btn.dataset.pid));
        wm.focus(Number(btn.dataset.pid));
      }
      closeWin();
    });
  }
  if (spaceEl) {
    spaceEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.target.closest("[data-id]");
      if (!btn) return;
      kernel.setSpace(btn.dataset.id);
      closeSpaces();
    });
  }
  if (recentEl) {
    recentEl.addEventListener("click", (e) => {
      e.stopPropagation();
      const btn = e.target.closest("[data-path]");
      if (!btn) return;
      closeRecent();
      openPath(btn.dataset.path);
    });
  }
  kernel.addEventListener("recent", () => {
    if (recentEl && !recentEl.hidden) paintRecent();
  });
  kernel.addEventListener("space", () => {
    if (spaceEl && spaceEl.classList.contains("open")) paintSpacePick();
  });

  document.addEventListener(
    "keydown",
    (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const winOpen = winEl && winEl.classList.contains("open");
      const spaceOpen = spaceEl && spaceEl.classList.contains("open");
      const recentOpen = recentEl && !recentEl.hidden;
      if (!winOpen && !spaceOpen && !recentOpen) return;
      if (e.key === "Escape") {
        hold(e);
        closeAll();
        return;
      }
      if (e.key === ";" || e.key === "；") {
        hold(e);
        if (winOpen) closeWin();
        else toggleWin();
        return;
      }
      if (e.key === "'" || e.key === "’") {
        hold(e);
        if (spaceOpen) closeSpaces();
        else toggleSpaces();
        return;
      }
      if (e.key === "r") {
        hold(e);
        if (recentOpen) closeRecent();
        else toggleRecent();
        return;
      }
      if (winOpen) {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          hold(e);
          winIndex += 1;
          paintWin(true);
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          hold(e);
          winIndex -= 1;
          paintWin(true);
        } else if (e.key === "PageDown") {
          hold(e);
          winIndex += 5;
          paintWin(true);
        } else if (e.key === "PageUp") {
          hold(e);
          winIndex -= 5;
          paintWin(true);
        } else if (e.key === "Home") {
          hold(e);
          winIndex = 0;
          paintWin(true);
        } else if (e.key === "End") {
          hold(e);
          winIndex = 999;
          paintWin(true);
        } else if (e.key === "Enter") {
          hold(e);
          activateWin();
        } else if (isJumpKey(e)) {
          hold(e);
          const wins = winRows();
          const items = wins.map((w) => ({ keys: `${w.title}|${w.appId}` }));
          winIndex = typeJump(items, winIndex, e.key, winType);
          paintWin(true);
        }
        return;
      }
      if (spaceOpen) {
        const btns = [...spaceEl.querySelectorAll("[data-id]")];
        if (!btns.length) return;
        let i = btns.findIndex((b) => b.dataset.id === spacePick);
        if (i < 0) i = 0;
        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
          hold(e);
          spacePick = btns[(i + 1) % btns.length].dataset.id;
          paintSpacePick();
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
          hold(e);
          spacePick = btns[(i - 1 + btns.length) % btns.length].dataset.id;
          paintSpacePick();
        } else if (e.key === "PageDown") {
          hold(e);
          spacePick = btns[Math.min(btns.length - 1, i + 8)].dataset.id;
          paintSpacePick();
        } else if (e.key === "PageUp") {
          hold(e);
          spacePick = btns[Math.max(0, i - 8)].dataset.id;
          paintSpacePick();
        } else if (e.key === "Home") {
          hold(e);
          spacePick = btns[0].dataset.id;
          paintSpacePick();
        } else if (e.key === "End") {
          hold(e);
          spacePick = btns[btns.length - 1].dataset.id;
          paintSpacePick();
        } else if (e.key === "Enter") {
          hold(e);
          enterSpace();
        } else if (isJumpKey(e)) {
          hold(e);
          const items = btns.map((b) => ({ keys: `${b.dataset.name}|${b.dataset.id}` }));
          const next = typeJump(items, i, e.key, spaceType);
          if (btns[next]) spacePick = btns[next].dataset.id;
          paintSpacePick();
        }
        return;
      }
      if (recentOpen) {
        const btns = [...recentLog.querySelectorAll("[data-path]")];
        if (!btns.length) return;
        if (e.key === "ArrowDown") {
          hold(e);
          recentPick = Math.min(btns.length - 1, recentPick + 1);
          paintRecentPick();
        } else if (e.key === "ArrowUp") {
          hold(e);
          recentPick = Math.max(0, recentPick - 1);
          paintRecentPick();
        } else if (e.key === "PageDown") {
          hold(e);
          recentPick = Math.min(btns.length - 1, recentPick + 8);
          paintRecentPick();
        } else if (e.key === "PageUp") {
          hold(e);
          recentPick = Math.max(0, recentPick - 8);
          paintRecentPick();
        } else if (e.key === "Home") {
          hold(e);
          recentPick = 0;
          paintRecentPick();
        } else if (e.key === "End") {
          hold(e);
          recentPick = btns.length - 1;
          paintRecentPick();
        } else if (e.key === "Enter") {
          hold(e);
          enterRecent();
        } else if (isJumpKey(e)) {
          hold(e);
          const items = btns.map((b) => ({ keys: `${b.dataset.name}|${b.dataset.path}` }));
          recentPick = typeJump(items, recentPick, e.key, recentType);
          paintRecentPick();
        }
      }
    },
    true
  );

  return {
    toggleWin,
    toggleSpaces,
    toggleRecent,
    closeWin,
    closeSpaces,
    closeRecent,
    closeAll,
  };
}
