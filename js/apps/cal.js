const SEKKI = [
  "立春", "雨水", "啓蟄", "春分", "清明", "穀雨",
  "立夏", "小満", "芒種", "夏至", "小暑", "大暑",
  "立秋", "処暑", "白露", "秋分", "寒露", "霜降",
  "立冬", "小雪", "大雪", "冬至", "小寒", "大寒",
];

export default {
  id: "cal",
  title: "祭暦",
  width: "min(560px, 80vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    const now = new Date();
    let viewY = now.getFullYear();
    let viewM = now.getMonth();
    let lastSig = "";

    function shift(delta) {
      viewM += delta;
      if (viewM < 0) {
        viewM = 11;
        viewY -= 1;
      } else if (viewM > 11) {
        viewM = 0;
        viewY += 1;
      }
      render();
    }

    function today() {
      const t = new Date();
      viewY = t.getFullYear();
      viewM = t.getMonth();
      render();
    }

    function render() {
      const t = new Date();
      const mark = viewY === t.getFullYear() && viewM === t.getMonth() ? t.getDate() : 0;
      const season = kernel.spacePref().season;
      const sig = `${viewY}|${viewM}|${mark}|${season}|${kernel.state.oncall.pref.name}`;
      if (sig === lastSig && el.querySelector(".cal-grid")) return;
      lastSig = sig;
      const first = new Date(viewY, viewM, 1);
      const start = first.getDay();
      const days = new Date(viewY, viewM + 1, 0).getDate();
      const sekki = SEKKI[viewM * 2 + ((mark || 1) > 15 ? 1 : 0)];
      const cells = [];
      for (let i = 0; i < start; i += 1) cells.push("<i></i>");
      for (let d = 1; d <= days; d += 1) {
        cells.push(`<b class="${d === mark ? " is-today" : ""}">${d}</b>`);
      }
      el.innerHTML = `
        <p class="lede">${viewY} / ${viewM + 1}</p>
        <p class="muted">季節は法律に優先する。いまは ${season} · ${sekki}。当直県 ${kernel.state.oncall.pref.name}。</p>
        <div class="boot-actions" style="margin:8px 0;justify-content:flex-start">
          <button class="btn" type="button" id="cal-prev">前の月</button>
          <button class="btn" type="button" id="cal-today">今日</button>
          <button class="btn" type="button" id="cal-next">次の月</button>
        </div>
        <div class="cal-grid">${["日", "月", "火", "水", "木", "金", "土"].map((w) => `<em>${w}</em>`).join("")}${cells.join("")}</div>
        <p class="muted">祭日はカーネルの合意枠。緊急でない意思決定は、桜と雪のあいだ遅延してよい。</p>
      `;
      el.querySelector("#cal-prev").onclick = () => shift(-1);
      el.querySelector("#cal-today").onclick = () => today();
      el.querySelector("#cal-next").onclick = () => shift(1);
    }

    render();
    const on = () => render();
    kernel.addEventListener("space", on);
    return {
      el,
      title: "matsuri.cal",
      onClose() {
        kernel.removeEventListener("space", on);
      },
    };
  },
};
