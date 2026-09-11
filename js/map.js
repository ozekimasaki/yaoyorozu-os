(function () {
  function renderMap() {
    const wrap = document.getElementById("map-nodes");
    const panel = document.getElementById("map-panel");
    if (!wrap) return;
    wrap.innerHTML = "";
    window.YAOYOROZU_PREFECTURES.forEach((p) => {
      const b = document.createElement("button");
      b.className = "node";
      if (p.unusedCpu >= 75) b.classList.add("cool");
      if (p.unusedCpu <= 30) b.classList.add("hot");
      b.style.left = `${p.x}%`;
      b.style.top = `${p.y}%`;
      b.title = p.name;
      b.setAttribute("aria-label", p.name);
      b.addEventListener("click", () => {
        panel.innerHTML = `
          <div class="tag">${p.region} / 未使用CPU ${p.unusedCpu}%</div>
          <h2 style="font-family:var(--font-serif);margin:0 0 8px">${p.name}</h2>
          <p class="muted">${p.kami}</p>
          <p>${p.protocol}</p>
          <p class="muted">特技: ${p.specialty}<br>危機: ${p.crisis}<br>機会: ${p.opportunity}</p>
          <p>季節: ${p.season} / 縁: ${p.en.toLocaleString("ja-JP")}</p>
        `;
      });
      wrap.appendChild(b);
    });
    wrap.querySelector("button")?.click();
  }

  window.YaoyorozuMap = { render: renderMap };
})();
