export default {
  id: "clip",
  title: "控え",
  width: "min(560px, 80vw)",
  height: "min(480px, 68vh)",
  spawn({ kernel, offer, path }) {
    const el = document.createElement("div");
    let lastSig = "";
    let pick = 0;
    let bound = false;

    function rows() {
      return kernel.state.clipboard || [];
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">言霊の控え</p>
        <p class="muted">コピーしたものが、ここに残る。空のスローガンは載せない。</p>
        <div class="fs-tree"></div>
        <div class="boot-actions" id="clip-keep" style="margin-top:12px;justify-content:flex-start">
          <button class="btn" type="button" id="clip-copy">再掲</button>
          <button class="btn" type="button" id="clip-drop">この札を下ろす</button>
          <button class="btn" type="button" id="clip-clear">すべて下ろす</button>
        </div>
      `;
      el.querySelector(".fs-tree").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-i]");
        if (!btn) return;
        pick = Number(btn.dataset.i);
        paintPick();
        copyPick();
      });
      el.querySelector("#clip-copy").onclick = () => copyPick();
      el.querySelector("#clip-drop").onclick = () => dropPick();
      el.querySelector("#clip-clear").onclick = () => kernel.clearClip();
    }

    function paintPick() {
      const btns = el.querySelectorAll("[data-i]");
      if (pick < 0) pick = 0;
      if (btns.length && pick >= btns.length) pick = btns.length - 1;
      btns.forEach((b, i) => b.classList.toggle("is-on", i === pick));
    }

    async function copyPick() {
      const rec = rows()[pick];
      if (!rec) return;
      try {
        await navigator.clipboard.writeText(rec.t);
        kernel.log("言霊を再掲した", "clip");
      } catch (err) {
        kernel.log(rec.t, "clip");
      }
    }

    function dropPick() {
      if (!rows().length) return;
      kernel.clipDrop(pick);
    }

    function jumpName(ch) {
      const needle = ch.toLowerCase();
      const list = rows();
      if (!list.length) return;
      const cur = Math.max(0, pick);
      for (let i = 1; i <= list.length; i += 1) {
        const j = (cur + i) % list.length;
        if ((list[j].t || "").toLowerCase().startsWith(needle)) {
          pick = j;
          paintPick();
          return;
        }
      }
    }

    function render() {
      bindOnce();
      const list = rows();
      const sig = list.map((r) => r.t).join("\n");
      const tree = el.querySelector(".fs-tree");
      if (sig !== lastSig || !tree.hasChildNodes()) {
        lastSig = sig;
        if (pick >= list.length) pick = Math.max(0, list.length - 1);
        if (!list.length) {
          tree.innerHTML = `<p class="muted">まだ何も写していない。</p>`;
        } else {
          tree.innerHTML = list
            .map(
              (r, i) =>
                `<button type="button" data-i="${i}">${r.t.slice(0, 80)}${r.t.length > 80 ? "\u2026" : ""}</button>`
            )
            .join("");
        }
        const clear = el.querySelector("#clip-clear");
        const drop = el.querySelector("#clip-drop");
        const copy = el.querySelector("#clip-copy");
        if (clear) clear.disabled = !list.length;
        if (drop) drop.disabled = !list.length;
        if (copy) copy.disabled = !list.length;
      }
      paintPick();
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
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        copyPick();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        dropPick();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        jumpName(e.key);
      }
    });
    if (offer || path) {
      const t = (offer && (offer.text || offer.path)) || path;
      if (t) kernel.clipPush(t);
    }
    render();
    const on = () => render();
    kernel.addEventListener("clip", on);
    return {
      el,
      title: "kotodama.clip",
      onFocus() {
        el.focus();
      },
      onOffer(next) {
        const t = (next && (next.text || next.path)) || "";
        if (t) kernel.clipPush(t);
        render();
      },
      onClose() {
        kernel.removeEventListener("clip", on);
      },
    };
  },
};
