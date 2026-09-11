(function () {
  function clock() {
    const el = document.getElementById("clock");
    const now = new Date();
    const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
    el.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}（${w}） ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}  季節:晩夏`;
  }

  function renderManifesto() {
    const root = document.getElementById("manifesto-body");
    root.innerHTML = window.YAOYOROZU_MANIFESTO.map(
      (c) => `<section class="chapter"><div class="num">CHAPTER ${c.ch}</div><h2>${c.title}</h2><p class="muted">${c.body}</p></section>`
    ).join("");
  }

  function renderConstitution() {
    const root = document.getElementById("constitution-body");
    const c = window.YAOYOROZU_CONSTITUTION;
    root.innerHTML = `<p class="lede">${c.title}</p><p class="muted">${c.preamble}</p>${c.articles
      .map(
        (a) => `<article class="article"><div class="n">第${a.n}</div><div><h3>${a.title}</h3><p class="muted">${a.body}</p></div></article>`
      )
      .join("")}`;
  }

  function renderProtocols() {
    const root = document.getElementById("protocol-body");
    root.innerHTML = `<div class="grid-2">${window.YAOYOROZU_PROTOCOLS.map(
      (p) => `<div class="card"><div class="tag">${p.layer}</div><h3>${p.name}</h3><p>${p.summary}</p><p class="muted">${p.spec}</p><p>指標: ${p.metric}</p></div>`
    ).join("")}</div>`;
  }

  function renderKami(filter = "") {
    const q = filter.trim();
    const rows = window.YAOYOROZU_KAMI.filter((k) => !q || `${k.name}${k.role}${k.note}${k.status}`.includes(q));
    document.getElementById("kami-count").textContent = String(rows.length);
    document.getElementById("kami-body").innerHTML = rows
      .map(
        (k) => `<tr>
        <td>${k.name}</td>
        <td>${k.role}</td>
        <td class="status-${k.status}">${k.status}</td>
        <td><div class="cpu-bar" title="${k.cpu}%"><span style="width:${k.cpu}%"></span></div></td>
        <td>${k.en.toLocaleString("ja-JP")}</td>
        <td class="muted">${k.note}</td>
      </tr>`
      )
      .join("");
  }

  function renderCentury() {
    document.getElementById("century-body").innerHTML = `
      <p class="lede">百年は、完了しないための計画である</p>
      <p class="muted">年表は約束ではない。戻れるように残した、未完了の道筋である。</p>
      ${window.YAOYOROZU_CENTURY.map(
        (c) => `<section class="chapter"><div class="num">${c.y}</div><h2>${c.title}</h2><p class="muted">${c.body}</p></section>`
      ).join("")}
    `;
  }

  function renderArch() {
    document.getElementById("arch-body").innerHTML = `
      <p class="lede">三相電源で動く国家</p>
      <p class="muted">法律だけでは乾く。祭だけでは散る。ソフトウェアだけでは冷たい。八百万OSは、この三つを同時に通電する。</p>
      <div class="grid-2">
        <div class="card"><div class="tag">LAYER 0</div><h3>列島ハードウェア</h3><p class="muted">山、海、雪、火山、温泉、線路、水道。所有ではなく、保守契約。</p></div>
        <div class="card"><div class="tag">LAYER 1</div><h3>注連縄 / 鳥居</h3><p class="muted">境界と通過。開くことと、閉じることの両方を仕様化する。</p></div>
        <div class="card"><div class="tag">LAYER 2-3</div><h3>奉納と縁</h3><p class="muted">見える税と、双方向の接続。GDPの代わりにGEPを積む。</p></div>
        <div class="card"><div class="tag">LAYER 4-5</div><h3>祭と間</h3><p class="muted">熱い合意と、意図的な無通信。アイドルは機能である。</p></div>
        <div class="card"><div class="tag">LAYER 7</div><h3>言霊コンパイラ</h3><p class="muted">約束、命名、謝罪だけが実行文。空のスローガンはコンパイルエラー。</p></div>
        <div class="card"><div class="tag">RUNTIME</div><h3>47カーネル連邦</h3><p class="muted">東京は親プロセスではない。端の山口も、別時間の沖縄も、同等のカーネル。</p></div>
      </div>
      <h2>最初の1000日</h2>
      <p class="muted">Day 1: 余っている神の申告。Day 100: 奉納税。Day 365: 無縁スキャン。Day 1000: 最初の遷宮。成功条件は、完了ではない。戻りやすさである。</p>
    `;
  }

  window.YaoyorozuApp = {
    start() {
      clock();
      setInterval(clock, 1000);
      renderManifesto();
      renderConstitution();
      renderProtocols();
      renderKami();
      renderArch();
      renderCentury();
      window.YaoyorozuMap.render();
      window.YaoyorozuSim.start();
      window.YaoyorozuTerm.start();
      document.getElementById("kami-search").addEventListener("input", (e) => renderKami(e.target.value));
      window.YaoyorozuWM.open("idea");
    },
  };
})();
