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

    async function render() {
      let rows = [];
      try {
        rows = await kernel.vfs.ls("/var/muen");
      } catch (err) {
        rows = [];
      }
      const sig = `${selected}\n${rows.map((f) => f.path).join("\n")}`;
      if (sig === lastSig && el.querySelector(".fs-tree")) return;
      lastSig = sig;
      el.innerHTML = `
        <p class="lede">無縁はゴミ箱ではない</p>
        <p class="muted">名を失った札。戻すことは、強制友情ではない。席を返すだけ。</p>
        <div class="fs-tree">
          ${
            rows
              .map(
                (f) =>
                  `<button type="button" class="${f.path === selected ? "is-on" : ""}" data-path="${f.path}">· ${f.name}${f.origin ? ` ← ${f.origin}` : ""}</button>`
              )
              .join("") || `<p class="muted">（空）</p>`
          }
        </div>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn primary" type="button" id="muen-restore">席へ戻す</button>
          <button class="btn" type="button" id="muen-read">読む</button>
          <button class="btn" type="button" id="muen-purge">清める</button>
        </div>
      `;
      el.querySelectorAll("[data-path]").forEach((btn) => {
        btn.onclick = () => {
          selected = btn.dataset.path;
          el.querySelectorAll("[data-path]").forEach((b) => b.classList.toggle("is-on", b.dataset.path === selected));
        };
      });
      el.querySelector("#muen-restore").onclick = async () => {
        if (!selected) return;
        try {
          const dest = await kernel.vfs.restoreFromMuen(selected);
          kernel.log(`restore ${selected} → ${dest}`, "fs");
          kernel.noteRecent(dest);
          selected = "";
          kernel.emit("vfs");
        } catch (err) {
          kernel.log(`restore: ${err.message}`, "fs");
        }
      };
      el.querySelector("#muen-read").onclick = () => {
        if (selected) launch("editor", { path: selected });
      };
      el.querySelector("#muen-purge").onclick = async () => {
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
      };
    }

    render();
    const on = () => render();
    kernel.addEventListener("vfs", on);
    return {
      el,
      title: "muen.box",
      onClose() {
        kernel.removeEventListener("vfs", on);
      },
    };
  },
};
