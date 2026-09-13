const SEKKI = [
  "立春", "雨水", "啓蟄", "春分", "清明", "穀雨",
  "立夏", "小満", "芒種", "夏至", "小暑", "大暑",
  "立秋", "処暑", "白露", "秋分", "寒露", "霜降",
  "立冬", "小雪", "大雪", "冬至", "小寒", "大寒",
];

function pad2(n) {
  return String(n).padStart(2, "0");
}

export default {
  id: "cal",
  title: "祭暦",
  width: "min(560px, 80vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    const now = new Date();
    let viewY = now.getFullYear();
    let viewM = now.getMonth();
    let pick = now.getDate();
    let lastSig = "";
    let noteSig = "";
    let notes = new Set();
    let bound = false;
    let digitQ = "";
    let digitT = 0;

    function daysInView() {
      return new Date(viewY, viewM + 1, 0).getDate();
    }

    function clampPick() {
      pick = Math.max(1, Math.min(daysInView(), pick || 1));
    }

    function dayPath(d) {
      return `/home/${kernel.state.ujiko}/cal/${viewY}-${pad2(viewM + 1)}-${pad2(d)}.ofuda`;
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede" id="cal-lede"></p>
        <p class="muted" id="cal-meta"></p>
        <div class="boot-actions" id="cal-keep" style="margin:8px 0;justify-content:flex-start">
          <button class="btn" type="button" id="cal-py">前年</button>
          <button class="btn" type="button" id="cal-prev">前の月</button>
          <button class="btn" type="button" id="cal-today">今日</button>
          <button class="btn" type="button" id="cal-next">次の月</button>
          <button class="btn" type="button" id="cal-ny">次年</button>
          <button class="btn primary" type="button" id="cal-open">この日の札</button>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
        <p class="muted">祭日はカーネルの合意枠。日を開くと、その日の札になる。緊急でない意思決定は、桜と雪のあいだ遅延してよい。</p>
      `;
      el.querySelector("#cal-py").onclick = () => shiftYear(-1);
      el.querySelector("#cal-prev").onclick = () => shift(-1);
      el.querySelector("#cal-today").onclick = () => today();
      el.querySelector("#cal-next").onclick = () => shift(1);
      el.querySelector("#cal-ny").onclick = () => shiftYear(1);
      el.querySelector("#cal-open").onclick = () => openDay(pick);
      el.querySelector("#cal-grid").addEventListener("click", (e) => {
        const cell = e.target.closest("[data-d]");
        if (!cell) return;
        pick = Number(cell.dataset.d);
        paintGrid();
        openDay(pick);
      });
    }

    function setText(sel, text) {
      const node = el.querySelector(sel);
      if (node && node.textContent !== text) node.textContent = text;
    }

    function paintGrid() {
      const t = new Date();
      const mark = viewY === t.getFullYear() && viewM === t.getMonth() ? t.getDate() : 0;
      const first = new Date(viewY, viewM, 1);
      const start = first.getDay();
      const days = daysInView();
      const prefix = `${viewY}-${pad2(viewM + 1)}-`;
      const cells = [];
      for (let i = 0; i < start; i += 1) cells.push("<i></i>");
      for (let d = 1; d <= days; d += 1) {
        const on = d === pick ? " is-on" : "";
        const todayCls = d === mark ? " is-today" : "";
        const note = notes.has(`${prefix}${pad2(d)}`) ? " is-note" : "";
        cells.push(`<b class="${on}${todayCls}${note}" data-d="${d}">${d}</b>`);
      }
      const grid = el.querySelector("#cal-grid");
      const html = `${["日", "月", "火", "水", "木", "金", "土"].map((w) => `<em>${w}</em>`).join("")}${cells.join("")}`;
      if (grid && grid.innerHTML !== html) grid.innerHTML = html;
    }

    function paintChrome() {
      const t = new Date();
      const mark = viewY === t.getFullYear() && viewM === t.getMonth() ? t.getDate() : 0;
      const season = kernel.spacePref().season;
      const sekki = SEKKI[viewM * 2 + ((mark || 1) > 15 ? 1 : 0)];
      setText("#cal-lede", `${viewY} / ${viewM + 1}`);
      setText("#cal-meta", `季節は法律に優先する。いまは ${season} · ${sekki}。当直県 ${kernel.state.oncall.pref.name}。`);
      paintGrid();
    }

    async function loadNotes() {
      let rows = [];
      try {
        rows = await kernel.vfs.ls(`/home/${kernel.state.ujiko}/cal`);
      } catch (err) {
        rows = [];
      }
      const next = new Set();
      for (const f of rows) {
        const m = (f.name || "").match(/^(\d{4}-\d{2}-\d{2})\.ofuda$/);
        if (m) next.add(m[1]);
      }
      const sig = [...next].sort().join("|");
      if (sig === noteSig) return;
      noteSig = sig;
      notes = next;
      if (bound) paintGrid();
    }

    async function openDay(d) {
      const day = Math.max(1, Math.min(daysInView(), Number(d) || pick));
      pick = day;
      paintGrid();
      const path = dayPath(day);
      try {
        await kernel.vfs.read(path);
      } catch (err) {
        const season = kernel.spacePref().season;
        await kernel.vfs.write(path, `${viewY}年${viewM + 1}月${day}日\n${season}\n`);
        kernel.noteRecent(path);
        kernel.emit("vfs");
      }
      launch("editor", { path });
    }

    function shift(delta) {
      viewM += delta;
      if (viewM < 0) {
        viewM = 11;
        viewY -= 1;
      } else if (viewM > 11) {
        viewM = 0;
        viewY += 1;
      }
      clampPick();
      render();
    }

    function shiftYear(delta) {
      viewY += delta;
      clampPick();
      render();
    }

    function today() {
      const t = new Date();
      viewY = t.getFullYear();
      viewM = t.getMonth();
      pick = t.getDate();
      render();
    }

    function jumpDigit(ch) {
      if (digitT) clearTimeout(digitT);
      digitQ += ch;
      digitT = setTimeout(() => {
        digitQ = "";
        digitT = 0;
      }, 800);
      const n = Number(digitQ);
      if (!n) return;
      pick = Math.max(1, Math.min(daysInView(), n));
      paintGrid();
    }

    function render() {
      bindOnce();
      const t = new Date();
      const mark = viewY === t.getFullYear() && viewM === t.getMonth() ? t.getDate() : 0;
      const season = kernel.spacePref().season;
      const sig = `${viewY}|${viewM}|${mark}|${pick}|${season}|${kernel.state.oncall.pref.name}|${noteSig}`;
      if (sig === lastSig && el.querySelector("#cal-keep")) return;
      lastSig = sig;
      paintChrome();
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        shift(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        shift(1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        shiftYear(-1);
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        shiftYear(1);
      } else if (e.key === "Home" || e.key === "t" || e.key === "T") {
        e.preventDefault();
        today();
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        openDay(pick);
      } else if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        jumpDigit(e.key);
      }
    });

    loadNotes().then(() => render());
    const onSpace = () => render();
    const onVfs = () => loadNotes();
    kernel.addEventListener("space", onSpace);
    kernel.addEventListener("vfs", onVfs);
    return {
      el,
      title: "matsuri.cal",
      onFocus() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("space", onSpace);
        kernel.removeEventListener("vfs", onVfs);
      },
    };
  },
};
