const SLOGAN = /(革命せよ|世界一|最高の|すべてを解決)/;

export default {
  id: "editor",
  title: "言霊",
  width: "min(720px, 86vw)",
  height: "min(560px, 74vh)",
  spawn({ kernel, launch, path }) {
    const el = document.createElement("div");
    let current = path || `/home/${kernel.state.ujiko}/untitled.ofuda`;
    let body = "";
    let saved = "";
    let dirty = false;
    let dirtyOnce = false;
    let autosaveT = 0;
    let readonly = false;

    async function persist(quiet = false) {
      if (readonly) return;
      await kernel.vfs.write(current, body, "text/plain");
      saved = body;
      dirty = false;
      kernel.noteRecent(current);
      kernel.emit("vfs");
      if (!quiet) kernel.log(`write ${current}`, "fs");
      if (SLOGAN.test(body)) kernel.log("compile warning: 空のスローガン", "kotodama");
    }

    async function load() {
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
        draw();
        return;
      }
      if (current === "/var/dmesg/current") {
        body = kernel.state.dmesg.join("\n");
        readonly = true;
        saved = body;
        draw();
        return;
      }
      if (current.startsWith("/proc/kami/")) {
        const id = current.split("/").pop();
        const kami = kernel.state.processes.find((p) => p.id === id);
        body = kami ? `${kami.name}\n${kami.role}\n${kami.note}` : "ESRCH";
        readonly = true;
        saved = body;
        draw();
        return;
      }
      const virt = kernel.procRead(current);
      if (virt) {
        body = virt.body;
        readonly = true;
        saved = body;
        draw();
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
      draw();
    }

    function draw() {
      const warn = SLOGAN.test(body) ? `<p class="warn">言霊コンパイラ: 空のスローガンを弾いた。約束だけが実行文。</p>` : "";
      el.innerHTML = `
        <p class="muted">${current}${readonly ? " · 読むだけ" : ""}</p>
        <textarea class="editor" spellcheck="false" ${readonly ? "readonly" : ""}></textarea>
        ${warn}
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start;flex-wrap:wrap">
          <button class="btn primary" type="button" id="save" ${readonly ? "disabled" : ""}>書く</button>
          <button class="btn" type="button" id="ed-box">匣を開く</button>
          <input class="search" id="ed-find" placeholder="札の中を探る" style="margin:0;max-width:200px" />
          <button class="btn" type="button" id="ed-find-go">探る</button>
        </div>
      `;
      const ta = el.querySelector(".editor");
      ta.value = body;
      ta.addEventListener("input", () => {
        body = ta.value;
        dirty = body !== saved;
        clearTimeout(autosaveT);
        if (!readonly) autosaveT = setTimeout(() => persist(true).catch(() => {}), 1800);
      });
      el.querySelector("#ed-find-go").onclick = () => {
        const q = el.querySelector("#ed-find").value;
        if (!q) return;
        const i = body.indexOf(q);
        if (i < 0) {
          kernel.log("探る: 見つからない", "kotodama");
          return;
        }
        ta.focus();
        ta.setSelectionRange(i, i + q.length);
      };
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
    }

    const onVfs = async () => {
      if (dirty || readonly) return;
      try {
        const f = await kernel.vfs.read(current);
        if (f.body === body) return;
        body = f.body;
        saved = body;
        const ta = el.querySelector(".editor");
        if (ta) ta.value = body;
      } catch (err) {
        /* 札が消えた日もある */
      }
    };
    kernel.addEventListener("vfs", onVfs);

    load();
    return {
      el,
      title: current.split("/").pop() || "言霊",
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
