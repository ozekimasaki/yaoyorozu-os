const SLOGAN = /(革命せよ|世界一|最高の|すべてを解決)/;

export default {
  id: "editor",
  title: "言霊",
  width: "min(720px, 86vw)",
  height: "min(560px, 74vh)",
  spawn({ kernel, path }) {
    const el = document.createElement("div");
    let current = path || `/home/${kernel.state.ujiko}/untitled.ofuda`;
    let body = "";

    async function load() {
      if (current.startsWith("/mnt/") && current.includes("/shrines/")) {
        const parts = current.split("/");
        const prefId = parts[2];
        const idx = Number((parts[4] || "0").replace(/\D/g, ""));
        const pref = kernel.state.prefs.find((p) => p.id === prefId);
        body = pref
          ? `${kernel.shrineName(pref, idx)}\n県: ${pref.name}\n神: ${pref.kami}\nこの社は遅延列挙された。開いたときだけ実体がある。`
          : "社が見つからない。";
        draw();
        return;
      }
      if (current === "/var/dmesg/current") {
        body = kernel.state.dmesg.join("\n");
        draw();
        return;
      }
      if (current.startsWith("/proc/kami/")) {
        const id = current.split("/").pop();
        const kami = kernel.state.processes.find((p) => p.id === id);
        body = kami ? `${kami.name}\n${kami.role}\n${kami.note}` : "ESRCH";
        draw();
        return;
      }
      try {
        const f = await kernel.vfs.read(current);
        body = f.body;
        kernel.noteRecent(current);
      } catch (err) {
        body = "";
      }
      draw();
    }

    function draw() {
      const warn = SLOGAN.test(body) ? `<p class="warn">言霊コンパイラ: 空のスローガンを弾いた。約束だけが実行文。</p>` : "";
      el.innerHTML = `
        <p class="muted">${current}</p>
        <textarea class="editor" spellcheck="false">${body.replace(/</g, "&lt;")}</textarea>
        ${warn}
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn primary" type="button" id="save">書く</button>
        </div>
      `;
      const ta = el.querySelector(".editor");
      ta.value = body;
      ta.addEventListener("input", () => {
        body = ta.value;
      });
      el.querySelector("#save").onclick = async () => {
        try {
          await kernel.vfs.write(current, body, "text/plain");
          kernel.log(`write ${current}`, "fs");
          kernel.noteRecent(current);
          kernel.emit("vfs");
          if (SLOGAN.test(body)) kernel.log("compile warning: 空のスローガン", "kotodama");
        } catch (err) {
          kernel.log(`write: ${err.message}`, "fs");
        }
      };
    }

    load();
    return {
      el,
      title: current.split("/").pop() || "言霊",
    };
  },
};
