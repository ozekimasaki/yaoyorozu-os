export default {
  id: "clip",
  title: "控え",
  width: "min(560px, 80vw)",
  height: "min(480px, 68vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let lastSig = "";
    let pick = 0;

    function rows() {
      return kernel.state.clipboard || [];
    }

    function paintPick() {
      const btns = el.querySelectorAll("[data-i]");
      if (pick < 0) pick = 0;
      if (btns.length && pick >= btns.length) pick = btns.length - 1;
      btns.forEach((b, i) => b.classList.toggle("is-on", i === pick));
    }

    function render() {
      const list = rows();
      const sig = list.map((r) => r.t).join("\n");
      if (sig === lastSig && el.querySelector(".fs-tree")) {
        paintPick();
        return;
      }
      lastSig = sig;
      if (pick >= list.length) pick = Math.max(0, list.length - 1);
      el.innerHTML = `
        <p class="lede">言霊の控え</p>
        <p class="muted">コピーしたものが、ここに残る。空のスローガンは載せない。</p>
        <div class="fs-tree">
          ${
            list.length
              ? list
                  .map(
                    (r, i) =>
                      `<button type="button" class="${i === pick ? "is-on" : ""}" data-i="${i}">${r.t.slice(0, 80)}${r.t.length > 80 ? "…" : ""}</button>`
                  )
                  .join("")
              : `<p class="muted">まだ何も写していない。</p>`
          }
        </div>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn" type="button" id="clip-clear" ${list.length ? "" : "disabled"}>札を下ろす</button>
        </div>
      `;
      el.querySelectorAll("[data-i]").forEach((btn) => {
        btn.onclick = async () => {
          pick = Number(btn.dataset.i);
          paintPick();
          const rec = list[pick];
          if (!rec) return;
          try {
            await navigator.clipboard.writeText(rec.t);
            kernel.log("言霊を再掲した", "clip");
          } catch (err) {
            kernel.log(rec.t, "clip");
          }
        };
      });
      const clear = el.querySelector("#clip-clear");
      if (clear) clear.onclick = () => kernel.clearClip();
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      const btns = el.querySelectorAll("[data-i]");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        pick = Math.min(btns.length - 1, pick + 1);
        paintPick();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        pick = Math.max(0, pick - 1);
        paintPick();
      } else if (e.key === "Home") {
        e.preventDefault();
        pick = 0;
        paintPick();
      } else if (e.key === "End") {
        e.preventDefault();
        pick = Math.max(0, btns.length - 1);
        paintPick();
      } else if (e.key === "Enter" && btns[pick]) {
        e.preventDefault();
        btns[pick].click();
      } else if (e.key === "Delete") {
        e.preventDefault();
        kernel.clearClip();
      }
    });
    render();
    const on = () => render();
    kernel.addEventListener("clip", on);
    return {
      el,
      title: "kotodama.clip",
      onFocus() {
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("clip", on);
      },
    };
  },
};
