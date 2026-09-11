function bitBoxes(bits, prefName) {
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
    const render = () => {
      const s = kernel.state;
      const o = s.oncall;
      const sig = `${s.authenticated}|${s.officialStatus || ""}|${s.currentSpace}|${o.entropy}`;
      if (sig === lastSig && el.querySelector(".grid-2")) return;
      lastSig = sig;
      const auth = s.authenticated
        ? `${s.officialStatus || "ATTACHED"}`
        : "AUTH required";
      el.innerHTML = `
        <p class="lede">今日の当直は、サイコロではない</p>
        <p class="muted">hash(${s.ujiko} + ${o.day}) = ${o.entropy}</p>
        <div class="hash-bits">${bitBoxes(o.bits)}</div>
        <div class="grid-2">
          <div class="card"><div class="tag">KAMI</div><h3>${o.kami.name}</h3><p class="muted">${o.kami.note || o.kami.role || ""}</p></div>
          <div class="card"><div class="tag">KERNEL</div><h3>${o.pref.name}</h3><p class="muted">未使用CPU ${o.pref.unusedCpu}% · 今いる空間 ${kernel.spacePref().name}</p></div>
          <div class="card"><div class="tag">REVEAL</div><h3>第${o.article}条</h3><p class="muted">憲法の朱印。同じシード。</p></div>
          <div class="card"><div class="tag">AUTH</div><h3>${auth}</h3><p class="muted">未ログアウト ${s.logoutDays} 日 · 来訪 ${s.visits}</p></div>
        </div>
        <p class="muted">次に起きうる割込: 無縁パケット / スワップ差し戻し / 注連縄deny / 枠の遷宮。時刻表は置かない。</p>
        <div class="boot-actions" style="margin:16px 0 0;justify-content:flex-start">
          <button class="btn primary" type="button" data-act="kashiwa">柏手</button>
          <button class="btn" type="button" data-act="map">当直県へ</button>
          <button class="btn" type="button" data-act="copy">控えを写す</button>
        </div>
      `;
      el.querySelector("[data-act=kashiwa]").onclick = () => kernel.emit("need-auth");
      el.querySelector("[data-act=map]").onclick = () => {
        kernel.setSpace(o.pref.id);
        kernel.emit("spotlight", o.pref.id);
        launch("map");
      };
      el.querySelector("[data-act=copy]").onclick = async () => {
        const line = `${s.ujiko}  ${auth}  ${o.pref.name}/${o.kami.name}`;
        try {
          await navigator.clipboard.writeText(line);
          kernel.log("控えを言霊へ写した", "kotodama");
        } catch (err) {
          kernel.log(line, "kotodama");
        }
      };
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
