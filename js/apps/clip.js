export default {
  id: "clip",
  title: "控え",
  width: "min(560px, 80vw)",
  height: "min(480px, 68vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let lastSig = "";
    const render = () => {
      const rows = kernel.state.clipboard || [];
      const sig = rows.map((r) => r.t).join("\n");
      if (sig === lastSig && el.querySelector(".fs-tree")) return;
      lastSig = sig;
      el.innerHTML = `
        <p class="lede">言霊の控え</p>
        <p class="muted">コピーしたものが、ここに残る。空のスローガンは載せない。</p>
        <div class="fs-tree">
          ${
            rows.length
              ? rows
                  .map(
                    (r, i) =>
                      `<button type="button" data-i="${i}">${r.t.slice(0, 80)}${r.t.length > 80 ? "…" : ""}</button>`
                  )
                  .join("")
              : `<p class="muted">まだ何も写していない。</p>`
          }
        </div>
      `;
      el.querySelectorAll("[data-i]").forEach((btn) => {
        btn.onclick = async () => {
          const rec = rows[Number(btn.dataset.i)];
          if (!rec) return;
          try {
            await navigator.clipboard.writeText(rec.t);
            kernel.log("言霊を再掲した", "clip");
          } catch (err) {
            kernel.log(rec.t, "clip");
          }
        };
      });
    };
    render();
    const on = () => render();
    kernel.addEventListener("clip", on);
    return {
      el,
      title: "kotodama.clip",
      onClose() {
        kernel.removeEventListener("clip", on);
      },
    };
  },
};
