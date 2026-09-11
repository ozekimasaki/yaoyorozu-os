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
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const start = first.getDay();
    const days = new Date(y, m + 1, 0).getDate();
    const sekki = SEKKI[m * 2 + (now.getDate() > 15 ? 1 : 0)];
    const cells = [];
    for (let i = 0; i < start; i += 1) cells.push("<i></i>");
    for (let d = 1; d <= days; d += 1) {
      const on = d === now.getDate() ? " is-today" : "";
      cells.push(`<b class="${on}">${d}</b>`);
    }
    el.innerHTML = `
      <p class="lede">${y} / ${m + 1}</p>
      <p class="muted">季節は法律に優先する。いまは ${kernel.spacePref().season} · ${sekki}。当直県 ${kernel.state.oncall.pref.name}。</p>
      <div class="cal-grid">${["日", "月", "火", "水", "木", "金", "土"].map((w) => `<em>${w}</em>`).join("")}${cells.join("")}</div>
      <p class="muted">祭日はカーネルの合意枠。緊急でない意思決定は、桜と雪のあいだ遅延してよい。</p>
    `;
    return { el, title: "matsuri.cal" };
  },
};
