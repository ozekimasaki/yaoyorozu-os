export default {
  id: "dmesg",
  title: "dmesg",
  width: "min(720px, 84vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let q = "";
    let follow = true;
    let hideFrom = 0;
    let lastSig = "";
    let bound = false;

    function lines() {
      const all = (kernel.state.dmesg || []).slice(hideFrom);
      const needle = q.trim().toLowerCase();
      if (!needle) return all;
      return all.filter((ln) => ln.toLowerCase().includes(needle));
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">核の鐘</p>
        <p class="muted">氏子課はここを読む。通知の既定は沈黙。</p>
        <div class="boot-actions" id="dmesg-keep" style="margin:0 0 12px;justify-content:flex-start">
          <input class="search" id="dmesg-q" type="search" placeholder="鐘を探る（tag / 文言）" style="margin:0;max-width:240px" />
          <button class="btn" type="button" id="dmesg-follow">追う</button>
          <button class="btn" type="button" id="dmesg-clear">見えている鐘を下ろす</button>
        </div>
        <div class="term-out" id="dmesg-out"></div>
      `;
      el.querySelector("#dmesg-q").addEventListener("input", (e) => {
        q = e.target.value;
        lastSig = "";
        paint();
      });
      el.querySelector("#dmesg-follow").onclick = () => {
        follow = !follow;
        paintFollow();
        if (follow) paint();
      };
      el.querySelector("#dmesg-clear").onclick = () => {
        hideFrom = (kernel.state.dmesg || []).length;
        lastSig = "";
        paint();
      };
    }

    function paintFollow() {
      const btn = el.querySelector("#dmesg-follow");
      if (btn) btn.textContent = follow ? "追う" : "止める";
    }

    function paint() {
      bindOnce();
      paintFollow();
      const shown = lines();
      const sig = `${q}|${shown.length}|${shown[shown.length - 1] || ""}`;
      if (sig === lastSig) return;
      lastSig = sig;
      const out = el.querySelector("#dmesg-out");
      const text = shown.join("\n") || "（まだ鐘は鳴っていない）";
      if (out && out.textContent !== text) out.textContent = text;
      if (follow && out) out.scrollTop = out.scrollHeight;
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        const box = el.querySelector("#dmesg-q");
        if (box) {
          box.focus();
          box.select();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        el.querySelector("#dmesg-clear")?.click();
        return;
      }
      if (e.target && e.target.tagName === "INPUT") return;
      const out = el.querySelector("#dmesg-out");
      if (e.key === "Home" && out) {
        e.preventDefault();
        follow = false;
        paintFollow();
        out.scrollTop = 0;
      } else if (e.key === "End" && out) {
        e.preventDefault();
        follow = true;
        paintFollow();
        out.scrollTop = out.scrollHeight;
      } else if (e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        follow = !follow;
        paintFollow();
        if (follow) paint();
      }
    });

    paint();
    const on = () => paint();
    kernel.addEventListener("dmesg", on);
    return {
      el,
      title: "kern.log",
      onFocus() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("dmesg", on);
      },
    };
  },
};
