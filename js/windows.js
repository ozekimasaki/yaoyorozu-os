(function () {
  const windows = {};
  let z = 20;

  function focusWin(id) {
    Object.values(windows).forEach((w) => w.el.classList.remove("focused"));
    const w = windows[id];
    if (!w || w.el.hidden) return;
    z += 1;
    w.el.style.zIndex = String(z);
    w.el.classList.add("focused");
    document.querySelectorAll(".dock button").forEach((b) => {
      b.classList.toggle("active", b.dataset.win === id);
    });
  }

  function openWin(id) {
    const w = windows[id];
    if (!w) return;
    w.el.hidden = false;
    w.el.style.display = "flex";
    w.minimized = false;
    focusWin(id);
  }

  function closeWin(id) {
    const w = windows[id];
    if (!w) return;
    w.el.hidden = true;
    w.el.style.display = "none";
    w.el.classList.remove("focused");
  }

  function minWin(id) {
    const w = windows[id];
    if (!w) return;
    w.el.style.display = "none";
    w.minimized = true;
  }

  function maxWin(id) {
    const w = windows[id];
    if (!w) return;
    w.maximized = !w.maximized;
    if (w.maximized) {
      w.prev = {
        left: w.el.style.left,
        top: w.el.style.top,
        width: w.el.style.width,
        height: w.el.style.height,
      };
      w.el.style.left = "12px";
      w.el.style.top = "54px";
      w.el.style.width = "calc(100% - 24px)";
      w.el.style.height = "calc(100% - 96px)";
    } else if (w.prev) {
      w.el.style.left = w.prev.left;
      w.el.style.top = w.prev.top;
      w.el.style.width = w.prev.width;
      w.el.style.height = w.prev.height;
    }
    focusWin(id);
  }

  function bindDrag(id) {
    const w = windows[id];
    const bar = w.el.querySelector(".titlebar");
    let dragging = false;
    let ox = 0;
    let oy = 0;
    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      dragging = true;
      focusWin(id);
      ox = e.clientX - w.el.offsetLeft;
      oy = e.clientY - w.el.offsetTop;
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", (e) => {
      if (!dragging || w.maximized) return;
      w.el.style.left = `${Math.max(0, e.clientX - ox)}px`;
      w.el.style.top = `${Math.max(42, e.clientY - oy)}px`;
    });
    bar.addEventListener("pointerup", () => {
      dragging = false;
    });
  }

  document.querySelectorAll(".window").forEach((el) => {
    windows[el.dataset.win] = { el, minimized: false, maximized: false };
    bindDrag(el.dataset.win);
    el.addEventListener("mousedown", () => focusWin(el.dataset.win));
  });

  document.querySelectorAll(".dock button, .js-open").forEach((btn) => {
    btn.addEventListener("click", () => openWin(btn.dataset.win));
  });

  document.querySelectorAll(".win-close").forEach((btn) => {
    btn.addEventListener("click", () => closeWin(btn.dataset.win));
  });
  document.querySelectorAll(".win-min").forEach((btn) => {
    btn.addEventListener("click", () => minWin(btn.dataset.win));
  });
  document.querySelectorAll(".win-max").forEach((btn) => {
    btn.addEventListener("click", () => maxWin(btn.dataset.win));
  });

  window.YaoyorozuWM = { open: openWin, close: closeWin, focus: focusWin };
})();
