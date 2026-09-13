function looksShot(name) {
  const n = String(name || "").toLowerCase();
  return n.endsWith(".png") || n.endsWith(".utsushi") || n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".webp") || n.endsWith(".gif");
}

function srcOf(file) {
  const body = String((file && file.body) || "");
  if (body.startsWith("data:image")) return body;
  const mime = String((file && file.mime) || "");
  if (mime.startsWith("image/") && body) return body;
  return "";
}

export default {
  id: "kagami",
  title: "\u93e1",
  width: "min(760px, 90vw)",
  height: "min(620px, 80vh)",
  spawn({ kernel, launch, path: startPath, offer }) {
    const el = document.createElement("div");
    el.className = "kagami-app";
    let cur = startPath || (offer && offer.path) || "";
    let rows = [];
    let lastSig = "";
    let busy = false;

    function layer() {
      return kernel.utsushi;
    }

    async function loadRows() {
      const u = layer();
      if (u && u.list) {
        try {
          rows = await u.list();
        } catch (err) {
          rows = [];
        }
      } else {
        try {
          const kids = await kernel.listPath("/var/utsushi");
          rows = kids.filter((k) => k.type !== "dir" && looksShot(k.name));
        } catch (err) {
          rows = [];
        }
      }
      if (!cur && rows.length) cur = rows[rows.length - 1].path;
      if (cur && !rows.some((r) => r.path === cur) && looksShot(cur)) {
        rows = [...rows, { path: cur, name: cur.split("/").pop() || cur }];
      }
      return rows;
    }

    async function paint() {
      const u = layer();
      const snap = u && u.snapshot ? u.snapshot() : { last: "", count: 0 };
      const sig = `${cur}|${rows.map((r) => r.path).join(",")}|${snap.count}|${busy}`;
      if (!el.querySelector(".kagami-body")) {
        el.innerHTML = `
          <div class="kagami-body">
            <p class="lede">\u93e1</p>
            <p class="muted" id="kagami-stat"></p>
            <div class="boot-actions" style="margin:0 0 10px;justify-content:flex-start;flex-wrap:wrap">
              <button class="btn primary" type="button" id="kagami-snap">\u6620\u3059</button>
              <button class="btn" type="button" id="kagami-prev">\u524d</button>
              <button class="btn" type="button" id="kagami-next">\u6b21</button>
              <button class="btn" type="button" id="kagami-box">\u5323\u3078</button>
              <button class="btn" type="button" id="kagami-desk">\u5353\u3078</button>
            </div>
            <div class="kagami-stage">
              <img id="kagami-img" alt="\u5199\u3057" hidden />
              <p class="muted" id="kagami-empty">\u307e\u3060\u6620\u3057\u3066\u3044\u306a\u3044\u3002</p>
            </div>
            <div class="kagami-list" id="kagami-list"></div>
          </div>
        `;
        bind();
      } else if (sig === lastSig) {
        return;
      }
      lastSig = sig;
      const stat = el.querySelector("#kagami-stat");
      if (stat) {
        stat.textContent = cur
          ? `${cur} \u00b7 ${rows.length}\u679a`
          : `\u5199\u3057 ${snap.count || 0}\u679a`;
      }
      const img = el.querySelector("#kagami-img");
      const empty = el.querySelector("#kagami-empty");
      if (cur) {
        try {
          const file = await kernel.readPath(cur);
          const src = srcOf(file);
          if (img) {
            if (src) {
              img.src = src;
              img.hidden = false;
            } else {
              img.removeAttribute("src");
              img.hidden = true;
            }
          }
          if (empty) empty.hidden = !!src;
        } catch (err) {
          if (img) {
            img.removeAttribute("src");
            img.hidden = true;
          }
          if (empty) {
            empty.hidden = false;
            empty.textContent = err.message || "ENOENT";
          }
        }
      } else {
        if (img) {
          img.removeAttribute("src");
          img.hidden = true;
        }
        if (empty) {
          empty.hidden = false;
          empty.textContent = "\u307e\u3060\u6620\u3057\u3066\u3044\u306a\u3044\u3002";
        }
      }
      const list = el.querySelector("#kagami-list");
      if (list) {
        list.replaceChildren();
        for (const row of rows.slice().reverse()) {
          const b = document.createElement("button");
          b.type = "button";
          b.dataset.path = row.path;
          b.textContent = row.name || row.path;
          b.classList.toggle("is-on", row.path === cur);
          list.appendChild(b);
        }
      }
      const snapBtn = el.querySelector("#kagami-snap");
      if (snapBtn) snapBtn.disabled = busy;
    }

    function move(delta) {
      if (!rows.length) return;
      const i = Math.max(0, rows.findIndex((r) => r.path === cur));
      const next = rows[(i + delta + rows.length) % rows.length];
      if (next) cur = next.path;
      paint();
    }

    async function doSnap() {
      const u = layer();
      if (!u || !u.snap) return;
      busy = true;
      await paint();
      try {
        const hit = await u.snap({ reason: "kagami" });
        cur = hit.path;
        await loadRows();
      } catch (err) {
        kernel.log(`kagami snap: ${err.message}`, "utsushi");
      }
      busy = false;
      lastSig = "";
      await paint();
    }

    function bind() {
      el.querySelector("#kagami-snap").onclick = () => doSnap();
      el.querySelector("#kagami-prev").onclick = () => move(-1);
      el.querySelector("#kagami-next").onclick = () => move(1);
      el.querySelector("#kagami-box").onclick = () => {
        const dest = cur ? cur.replace(/\/[^/]+$/, "") || "/var/utsushi" : "/var/utsushi";
        if (launch) launch("fs", { path: dest });
      };
      el.querySelector("#kagami-desk").onclick = () => {
        if (!cur || !kernel.keshiki || !kernel.keshiki.set) return;
        kernel.keshiki.set(cur).catch((err) => kernel.log(`keshiki: ${err.message}`, "keshiki"));
      };
      el.querySelector("#kagami-list").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-path]");
        if (!btn) return;
        cur = btn.dataset.path;
        paint();
      });
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        move(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        move(1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        doSnap();
      }
    });

    const onU = () => {
      loadRows().then(paint);
    };
    kernel.addEventListener("utsushi", onU);
    kernel.addEventListener("vfs", onU);

    loadRows().then(paint);

    return {
      el,
      title: "\u93e1",
      onFocus() {
        el.focus();
      },
      onOffer(next) {
        const p = next && next.path;
        if (p) cur = p;
        loadRows().then(paint);
      },
      onDrop(paths) {
        if (paths && paths[0]) cur = paths[0];
        loadRows().then(paint);
      },
      onClose() {
        kernel.removeEventListener("utsushi", onU);
        kernel.removeEventListener("vfs", onU);
      },
    };
  },
};
