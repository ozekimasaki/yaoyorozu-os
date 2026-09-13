export default {
  id: "muen",
  title: "無縁",
  width: "min(720px, 86vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    let selected = "";
    let lastSig = "";
    let purgeOnce = false;
    let bound = false;

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">無縁はゴミ箱ではない</p>
        <p class="muted">名を失った札。戻すことは、強制友情ではない。席を返すだけ。</p>
        <p class="muted" id="muen-count"></p>
        <div class="fs-tree"></div>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn primary" type="button" id="muen-restore">席へ戻す</button>
          <button class="btn" type="button" id="muen-read">読む</button>
          <button class="btn" type="button" id="muen-purge">清める</button>
        </div>
      `;
      el.querySelector(".fs-tree").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-path]");
        if (!btn) return;
        selected = btn.dataset.path;
        purgeOnce = false;
        paintSel();
      });
      el.querySelector("#muen-restore").onclick = () => restore();
      el.querySelector("#muen-read").onclick = () => read();
      el.querySelector("#muen-purge").onclick = () => purge();
    }

    function paintSel() {
      el.querySelectorAll("[data-path]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.path === selected);
      });
    }

    function jumpName(ch) {
      const needle = ch.toLowerCase();
      const btns = [...el.querySelectorAll("[data-path]")];
      if (!btns.length) return;
      const cur = Math.max(0, btns.findIndex((b) => b.dataset.path === selected));
      for (let i = 1; i <= btns.length; i += 1) {
        const j = (cur + i) % btns.length;
        const keys = (btns[j].dataset.jump || "").toLowerCase().split("|");
        if (keys.some((k) => k.startsWith(needle))) {
          selected = btns[j].dataset.path;
          paintSel();
          btns[j].scrollIntoView({ block: "nearest" });
          return;
        }
      }
    }

    function moveSel(dir) {
      const btns = [...el.querySelectorAll("[data-path]")];
      if (!btns.length) return;
      let i = btns.findIndex((b) => b.dataset.path === selected);
      if (i < 0) i = dir > 0 ? -1 : 0;
      i = Math.max(0, Math.min(btns.length - 1, i + dir));
      selected = btns[i].dataset.path;
      paintSel();
      btns[i].scrollIntoView({ block: "nearest" });
    }

    async function restore() {
      if (!selected) return;
      try {
        const dest = await kernel.vfs.restoreFromMuen(selected);
        kernel.log(`restore ${selected} \u2192 ${dest}`, "fs");
        kernel.noteRecent(dest);
        selected = "";
        kernel.emit("vfs");
      } catch (err) {
        kernel.log(`restore: ${err.message}`, "fs");
      }
    }

    function read() {
      if (selected) launch("editor", { path: selected });
    }

    async function purge() {
      if (!purgeOnce) {
        purgeOnce = true;
        kernel.log("無縁: もう一度押すと札を清める。戻せず、名も消える", "muen");
        return;
      }
      purgeOnce = false;
      const n = await kernel.vfs.purgeMuen();
      kernel.noteOshi(`無縁を清めた ${n}`, "muen");
      selected = "";
      lastSig = "";
      kernel.emit("vfs");
    }

    async function render() {
      bindOnce();
      let rows = [];
      try {
        rows = await kernel.vfs.ls("/var/muen");
      } catch (err) {
        rows = [];
      }
      const sig = rows.map((f) => `${f.path}:${f.origin || ""}`).join("\n");
      const tree = el.querySelector(".fs-tree");
      if (sig !== lastSig || !tree.querySelector("[data-path], .muted")) {
        lastSig = sig;
        if (!rows.length) {
          tree.innerHTML = `<p class="muted">\uff08空\uff09</p>`;
        } else {
          tree.innerHTML = rows
            .map((f) => {
              const raw = (f.name || "").replace(/^\d+-/, "");
              const originName = f.origin ? kernel.vfs.nameOf(f.origin) : "";
              const jump = [originName, raw, f.name].filter(Boolean).join("|");
              return `<button type="button" data-path="${f.path}" data-jump="${jump}">\u00b7 ${f.name}${
                f.origin ? ` \u2190 ${f.origin}` : ""
              }</button>`;
            })
            .join("");
        }
        const count = el.querySelector("#muen-count");
        if (count) count.textContent = rows.length ? `${rows.length} 枚` : "空";
      }
      if (selected && !rows.some((f) => f.path === selected)) selected = "";
      paintSel();
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        moveSel(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        moveSel(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = el.querySelector("[data-path]");
        if (first) {
          selected = first.dataset.path;
          paintSel();
        }
      } else if (e.key === "End") {
        e.preventDefault();
        const btns = el.querySelectorAll("[data-path]");
        const last = btns[btns.length - 1];
        if (last) {
          selected = last.dataset.path;
          paintSel();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        restore();
      } else if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        read();
      } else if (e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        purge();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        jumpName(e.key);
      }
    });

    render();
    const on = () => render();
    kernel.addEventListener("vfs", on);
    return {
      el,
      title: "muen.box",
      onFocus() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("vfs", on);
      },
    };
  },
};
