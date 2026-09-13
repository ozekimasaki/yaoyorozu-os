function bitBoxes(bits) {
  return bits
    .split("")
    .map((b, i) => `<i class="${b === "1" ? "on" : ""}" title="bit ${i}">${b}</i>`)
    .join("");
}

export default {
  id: "oncall",
  title: "当直",
  width: "min(640px, 84vw)",
  height: "min(560px, 74vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    let lastSig = "";
    let lastBits = "";
    let bound = false;

    function setText(sel, text) {
      const node = el.querySelector(sel);
      if (node && node.textContent !== text) node.textContent = text;
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">今日の当直は、サイコロではない</p>
        <p class="muted" id="oncall-hash"></p>
        <div class="hash-bits" id="oncall-bits"></div>
        <div class="grid-2">
          <div class="card" data-k="kami"><div class="tag">KAMI</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="pref"><div class="tag">KERNEL</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="art"><div class="tag">REVEAL</div><h3></h3><p class="muted">憲法の朱印。同じシード。</p></div>
          <div class="card" data-k="auth"><div class="tag">AUTH</div><h3></h3><p class="muted"></p></div>
        </div>
        <p class="muted">次に起きうる割込: 無縁パケット / スワップ差し戻し / 注連縄deny / 枠の遷宮。時刻表は置かない。</p>
        <div class="boot-actions" id="oncall-keep" style="margin:16px 0 0;justify-content:flex-start">
          <button class="btn primary" type="button" data-act="kashiwa">柏手</button>
          <button class="btn" type="button" data-act="map">当直県へ</button>
          <button class="btn" type="button" data-act="copy">控えを写す</button>
        </div>
      `;
      el.querySelector("[data-act=kashiwa]").onclick = () => kernel.emit("need-auth");
      el.querySelector("[data-act=map]").onclick = () => {
        kernel.setSpace(kernel.state.oncall.pref.id);
        kernel.emit("spotlight", kernel.state.oncall.pref.id);
        launch("map");
      };
      el.querySelector("[data-act=copy]").onclick = async () => {
        const s = kernel.state;
        const o = s.oncall;
        const auth = s.authenticated ? `${s.officialStatus || "ATTACHED"}` : "AUTH required";
        const line = `${s.ujiko}  ${auth}  ${o.pref.name}/${o.kami.name}`;
        try {
          await navigator.clipboard.writeText(line);
          kernel.log("控えを言霊へ写した", "kotodama");
        } catch (err) {
          kernel.log(line, "kotodama");
        }
      };
    }

    function paintCards() {
      const s = kernel.state;
      const o = s.oncall;
      const auth = s.authenticated ? `${s.officialStatus || "ATTACHED"}` : "AUTH required";
      setText("#oncall-hash", `hash(${s.ujiko} + ${o.day}) = ${o.entropy}`);
      if (o.bits !== lastBits) {
        lastBits = o.bits;
        const bits = el.querySelector("#oncall-bits");
        if (bits) bits.innerHTML = bitBoxes(o.bits);
      }
      setText("[data-k=kami] h3", o.kami.name);
      setText("[data-k=kami] .muted", o.kami.note || o.kami.role || "");
      setText("[data-k=pref] h3", o.pref.name);
      setText("[data-k=pref] .muted", `未使用CPU ${o.pref.unusedCpu}% · 今いる空間 ${kernel.spacePref().name}`);
      setText("[data-k=art] h3", `第${o.article}条`);
      setText("[data-k=auth] h3", auth);
      setText("[data-k=auth] .muted", `未ログアウト ${s.logoutDays} 日 · 来訪 ${s.visits}`);
    }

    const render = () => {
      bindOnce();
      const s = kernel.state;
      const o = s.oncall;
      const sig = `${s.authenticated}|${s.officialStatus || ""}|${s.currentSpace}|${o.entropy}`;
      if (sig === lastSig && el.querySelector("#oncall-keep")) return;
      lastSig = sig;
      paintCards();
    };

    render();
    const on = () => render();
    kernel.addEventListener("auth", on);
    kernel.addEventListener("space", on);
    return {
      el,
      title: "oncall.sched",
      onClose() {
        kernel.removeEventListener("auth", on);
        kernel.removeEventListener("space", on);
      },
    };
  },
};
