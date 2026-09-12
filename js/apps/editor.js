const SLOGAN = /(革命せよ|世界一|最高の|すべてを解決)/;

export default {
  id: "editor",
  title: "言霊",
  width: "min(720px, 86vw)",
  height: "min(560px, 74vh)",
  spawn({ kernel, launch, path, pid, wm }) {
    const el = document.createElement("div");
    let current = path || `/home/${kernel.state.ujiko}/untitled.ofuda`;
    let body = "";
    let saved = "";
    let dirty = false;
    let dirtyOnce = false;
    let autosaveT = 0;
    let readonly = false;
    let bound = false;
    let wrap = false;
    let wrapHeld = false;
    let chromeSig = "";

    function leafName() {
      return current.split("/").pop() || "言霊";
    }

    function syncChrome() {
      const lines = body ? body.split("\n").length : 1;
      const sig = `${current}|${readonly ? 1 : 0}|${dirty ? 1 : 0}|${lines}|${wrap ? 1 : 0}`;
      if (sig === chromeSig) return;
      chromeSig = sig;
      const pathEl = el.querySelector(".ed-path");
      if (pathEl) {
        const line = `${current}${readonly ? " · 読むだけ" : ""}${dirty ? " · 未書" : ""} · ${lines}行`;
        if (pathEl.textContent !== line) pathEl.textContent = line;
      }
      const ta = el.querySelector(".editor");
      if (ta) {
        ta.readOnly = readonly;
        ta.classList.toggle("is-wrap", wrap);
        ta.setAttribute("wrap", wrap ? "soft" : "off");
      }
      const save = el.querySelector("#save");
      if (save) save.disabled = readonly;
      const wrapBtn = el.querySelector("#ed-wrap");
      if (wrapBtn) wrapBtn.textContent = wrap ? "ほどく" : "折り返す";
      if (wm && pid) wm.setTitle(pid, `${dirty ? "* " : ""}${leafName()}`);
    }

    function syncWarn() {
      let warn = el.querySelector(".warn");
      const bad = SLOGAN.test(body);
      if (bad && !warn) {
        warn = document.createElement("p");
        warn.className = "warn";
        warn.textContent = "言霊コンパイラ: 空のスローガンを弾いた。約束だけが実行文。";
        const ta = el.querySelector(".editor");
        if (ta) ta.after(warn);
      } else if (!bad && warn) {
        warn.remove();
      }
    }

    function markDirty() {
      const next = body !== saved;
      if (next === dirty) return;
      dirty = next;
      syncChrome();
    }

    async function persist(quiet = false) {
      if (readonly) return;
      await kernel.vfs.write(current, body, "text/plain");
      saved = body;
      dirty = false;
      kernel.noteRecent(current);
      kernel.emit("vfs");
      if (!quiet) kernel.log(`write ${current}`, "fs");
      if (SLOGAN.test(body)) kernel.log("compile warning: 空のスローガン", "kotodama");
      syncChrome();
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="muted ed-path"></p>
        <textarea class="editor" spellcheck="false"></textarea>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start;flex-wrap:wrap">
          <button class="btn primary" type="button" id="save">書く</button>
          <button class="btn" type="button" id="ed-box">${String.fromCharCode(0x5323)}を開く</button>
          <input class="search" id="ed-find" placeholder="札の中を探る" style="margin:0;max-width:160px" />
          <button class="btn" type="button" id="ed-find-go">次</button>
          <button class="btn" type="button" id="ed-find-prev">前</button>
          <span class="muted ed-hits" id="ed-hits" hidden></span>
          <input class="search" id="ed-repl" placeholder="換える文" style="margin:0;max-width:160px" />
          <button class="btn" type="button" id="ed-repl-go">換える</button>
          <button class="btn" type="button" id="ed-repl-all">すべて</button>
          <input class="search" id="ed-line" placeholder="行" inputmode="numeric" style="margin:0;max-width:72px" />
          <button class="btn" type="button" id="ed-goto">行へ</button>
          <button class="btn" type="button" id="ed-wrap">折り返す</button>
        </div>
      `;
      const ta = el.querySelector(".editor");
      ta.addEventListener("input", () => {
        body = ta.value;
        markDirty();
        syncChrome();
        syncWarn();
        clearTimeout(autosaveT);
        if (!readonly) autosaveT = setTimeout(() => persist(true).catch(() => {}), 1800);
      });
      function gotoLine() {
        const n = Number((el.querySelector("#ed-line").value || "").trim());
        if (!n || n < 1) {
          el.querySelector("#ed-line").focus();
          return;
        }
        const lines = body.split("\n");
        const idx = Math.min(n, lines.length) - 1;
        let pos = 0;
        for (let i = 0; i < idx; i += 1) pos += lines[i].length + 1;
        const end = pos + (lines[idx] || "").length;
        ta.focus();
        ta.setSelectionRange(pos, end);
      }
      function paintHits(q, src, at) {
        const hits = el.querySelector("#ed-hits");
        if (!hits) return;
        if (!q) {
          if (!hits.hidden) {
            hits.hidden = true;
            hits.textContent = "";
          }
          return;
        }
        let n = 0;
        let nth = 0;
        let from = 0;
        const step = Math.max(1, q.length);
        while (from <= src.length) {
          const i = src.indexOf(q, from);
          if (i < 0) break;
          n += 1;
          if (i === at) nth = n;
          from = i + step;
        }
        const next = n ? `${nth || "—"}/${n}` : "0";
        if (hits.textContent === next && !hits.hidden) return;
        hits.textContent = next;
        hits.hidden = false;
      }
      function findNext(dir = 1) {
        const q = el.querySelector("#ed-find").value;
        const src = ta.value;
        body = src;
        if (!q) {
          el.querySelector("#ed-find").focus();
          paintHits("", src, -1);
          return false;
        }
        let i = -1;
        if (dir >= 0) {
          i = src.indexOf(q, ta.selectionEnd || 0);
          if (i < 0 || i === ta.selectionStart) i = src.indexOf(q, 0);
        } else {
          const before = (ta.selectionStart || 0) > 0 ? src.lastIndexOf(q, ta.selectionStart - 1) : -1;
          i = before >= 0 ? before : src.lastIndexOf(q);
        }
        if (i < 0) {
          paintHits(q, src, -1);
          kernel.log("探る: 見つからない", "kotodama");
          return false;
        }
        ta.focus();
        ta.setSelectionRange(i, i + q.length);
        paintHits(q, src, i);
        return true;
      }
      function takeBody() {
        body = ta.value;
        markDirty();
        syncChrome();
        syncWarn();
      }
      function replaceOne() {
        if (readonly) return;
        const q = el.querySelector("#ed-find").value;
        const r = el.querySelector("#ed-repl").value;
        if (!q) {
          el.querySelector("#ed-find").focus();
          return;
        }
        const start = ta.selectionStart || 0;
        const end = ta.selectionEnd || 0;
        if (start !== end && body.slice(start, end) === q) {
          ta.setRangeText(r, start, end, "end");
          takeBody();
          return;
        }
        if (!findNext()) return;
        ta.setRangeText(r, ta.selectionStart, ta.selectionEnd, "end");
        takeBody();
      }
      function replaceAll() {
        if (readonly) return;
        const q = el.querySelector("#ed-find").value;
        const r = el.querySelector("#ed-repl").value;
        if (!q) {
          el.querySelector("#ed-find").focus();
          return;
        }
        if (!body.includes(q)) {
          kernel.log("換える: 見つからない", "kotodama");
          return;
        }
        const n = body.split(q).length - 1;
        body = body.split(q).join(r);
        ta.value = body;
        takeBody();
        paintHits(q, body, -1);
        kernel.log(`言霊を換えた ×${n}`, "kotodama");
      }
      ta.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
          e.preventDefault();
          persist(false).catch((err) => kernel.log(`write: ${err.message}`, "fs"));
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
          e.preventDefault();
          const find = el.querySelector("#ed-find");
          find.focus();
          find.select();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "H")) {
          e.preventDefault();
          const repl = el.querySelector("#ed-repl");
          repl.focus();
          repl.select();
        }
        if (e.key === "F3") {
          e.preventDefault();
          findNext(e.shiftKey ? -1 : 1);
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
          e.preventDefault();
          gotoLine();
        }
      });
      el.querySelector("#ed-find-go").onclick = () => findNext(1);
      el.querySelector("#ed-find-prev").onclick = () => findNext(-1);
      el.querySelector("#ed-repl-go").onclick = () => replaceOne();
      el.querySelector("#ed-repl-all").onclick = () => replaceAll();
      el.querySelector("#ed-repl").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (e.shiftKey) replaceAll();
          else replaceOne();
        }
      });
      el.querySelector("#ed-goto").onclick = () => gotoLine();
      el.querySelector("#ed-line").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          gotoLine();
        }
      });
      el.querySelector("#ed-find").addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "h" || e.key === "H")) {
          e.preventDefault();
          const repl = el.querySelector("#ed-repl");
          repl.focus();
          repl.select();
          return;
        }
        if (e.key === "Enter" || e.key === "F3") {
          e.preventDefault();
          findNext(e.shiftKey ? -1 : 1);
        }
      });
      el.querySelector("#save").onclick = async () => {
        try {
          await persist(false);
        } catch (err) {
          kernel.log(`write: ${err.message}`, "fs");
        }
      };
      el.querySelector("#ed-box").onclick = () => {
        launch("fs", { path: kernel.vfs.parentOf(current) });
      };
      el.querySelector("#ed-wrap").onclick = () => {
        wrapHeld = true;
        wrap = !wrap;
        kernel.vfs.metaSet("editorWrap", wrap);
        syncChrome();
      };
    }

    function paintBody() {
      bindOnce();
      const ta = el.querySelector(".editor");
      if (ta && ta.value !== body) ta.value = body;
      syncWarn();
      syncChrome();
    }

    async function load() {
      readonly = false;
      if (current.startsWith("/mnt/") && current.includes("/shrines/")) {
        const parts = current.split("/");
        const prefId = parts[2];
        const idx = Number((parts[4] || "0").replace(/\D/g, ""));
        const pref = kernel.state.prefs.find((p) => p.id === prefId);
        body = pref
          ? `${kernel.shrineName(pref, idx)}\n県: ${pref.name}\n神: ${pref.kami}\nこの社は遅延列挙された。開いたときだけ実体がある。`
          : "社が見つからない。";
        readonly = true;
        saved = body;
        paintBody();
        return;
      }
      if (current === "/var/dmesg/current") {
        body = kernel.state.dmesg.join("\n");
        readonly = true;
        saved = body;
        paintBody();
        return;
      }
      if (current.startsWith("/proc/kami/")) {
        const id = current.split("/").pop();
        const kami = kernel.state.processes.find((p) => p.id === id);
        body = kami ? `${kami.name}\n${kami.role}\n${kami.note}` : "ESRCH";
        readonly = true;
        saved = body;
        paintBody();
        return;
      }
      const virt = kernel.procRead(current);
      if (virt) {
        body = virt.body;
        readonly = true;
        saved = body;
        paintBody();
        return;
      }
      try {
        const f = await kernel.readPath(current);
        body = f.body;
        kernel.noteRecent(current);
      } catch (err) {
        body = "";
      }
      saved = body;
      dirty = false;
      paintBody();
    }

    const onVfs = async () => {
      if (dirty || readonly) return;
      try {
        const f = await kernel.vfs.read(current);
        if (f.body === body) return;
        body = f.body;
        saved = body;
        const ta = el.querySelector(".editor");
        if (ta && document.activeElement !== ta) ta.value = body;
        else if (ta) ta.value = body;
        syncChrome();
      } catch (err) {
        /* 札が消えた日もある */
      }
    };
    kernel.addEventListener("vfs", onVfs);

    kernel.vfs
      .metaGet("editorWrap")
      .then((v) => {
        if (wrapHeld) return;
        wrap = !!v;
        syncChrome();
      })
      .catch(() => {});

    load();
    return {
      el,
      title: leafName(),
      onDrop(paths) {
        const files = (paths || []).filter(Boolean);
        if (!files.length) return;
        if (dirty) {
          files.forEach((p) => launch("editor", { path: p }));
          return;
        }
        current = files[0];
        load();
        files.slice(1).forEach((p) => launch("editor", { path: p }));
      },
      onClose() {
        kernel.removeEventListener("vfs", onVfs);
        clearTimeout(autosaveT);
        if (readonly || !dirty) return true;
        if (!dirtyOnce) {
          dirtyOnce = true;
          kernel.log("言霊: 書いていない文がある。もう一度閉じると捨てる", "kotodama");
          return false;
        }
        return true;
      },
    };
  },
};
