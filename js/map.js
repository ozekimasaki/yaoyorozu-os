(function () {
  function byId() {
    const m = new Map();
    window.YAOYOROZU_PREFECTURES.forEach((p) => m.set(p.id, p));
    return m;
  }

  function landColor(cpu) {
    if (cpu >= 85) return "#4f7d61";
    if (cpu >= 70) return "#3d5c4a";
    if (cpu >= 50) return "#8a7328";
    if (cpu >= 35) return "#8a4a1c";
    return "#7a241c";
  }

  function heatKind(cpu) {
    if (cpu >= 75) return "cool";
    if (cpu <= 35) return "hot";
    return "mid";
  }

  function omenLine() {
    const o = window.YaoyorozuOracle;
    const lines = [
      "この土地の神は、いま名簿を更新している。",
      "余白は、都市が失った最も高価な資源である。",
      "過疎はバグではない。余白である。",
      "ここにログアウト用の鳥居はない。",
      "県境は、プロセス境界である。",
    ];
    return o ? o.pick(lines) : lines[1];
  }

  function panelHtml(p) {
    return `
      <div class="tag">${p.region} / ${p.code} / 未使用CPU ${p.unusedCpu}%</div>
      <h2>${p.name}</h2>
      <p class="muted">${p.kami}</p>
      <p>${p.protocol}</p>
      <p class="muted">特技: ${p.specialty}<br>危機: ${p.crisis}<br>機会: ${p.opportunity}</p>
      <p>季節: ${p.season} / 縁: ${p.en.toLocaleString("ja-JP")}</p>
      <p class="muted">${omenLine()}</p>
    `;
  }

  function selectPref(p, svg, panel, callout, selectEl) {
    svg.querySelectorAll(".pref").forEach((el) => {
      const on = el.dataset.pref === p.id;
      el.classList.toggle("is-selected", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });
    panel.innerHTML = panelHtml(p);
    callout.textContent = `${p.name} · 未使用 ${p.unusedCpu}%`;
    if (selectEl && selectEl.value !== p.id) selectEl.value = p.id;
  }

  async function renderMap() {
    const host = document.getElementById("japan-map-host");
    const panel = document.getElementById("map-panel");
    const callout = document.getElementById("map-callout");
    const selectEl = document.getElementById("map-select");
    if (!host || !panel) return;

    const prefs = byId();
    if (selectEl && !selectEl.options.length) {
      window.YAOYOROZU_PREFECTURES.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.code} ${p.name}`;
        selectEl.appendChild(opt);
      });
    }

    const sources = [
      new URL("svg/japan-prefectures.svg", document.baseURI).href,
      "https://cdn.jsdelivr.net/npm/@svg-maps/japan@2.0.0/japan.svg",
    ];
    let loaded = false;
    for (const href of sources) {
      try {
        const res = await fetch(href);
        if (!res.ok) continue;
        host.innerHTML = await res.text();
        loaded = true;
        break;
      } catch (err) {
        /* try next source */
      }
    }
    if (!loaded) {
      host.innerHTML = "";
      panel.innerHTML = `<p class="muted">列島の地図を呼べなかった。器が欠けている。</p>`;
      return;
    }

    const svg = host.querySelector("svg");
    if (!svg) return;
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.classList.add("japan-map");
    svg.removeAttribute("width");
    svg.removeAttribute("height");

    svg.querySelectorAll("path[id]").forEach((el) => {
      if (!el.dataset.pref) el.dataset.pref = el.id;
      el.classList.add("pref");
    });

    svg.querySelectorAll(".pref").forEach((el) => {
      const p = prefs.get(el.dataset.pref);
      if (!p) return;
      el.tabIndex = -1;
      el.classList.add(heatKind(p.unusedCpu));
      el.style.setProperty("--land", landColor(p.unusedCpu));
      const activate = () => selectPref(p, svg, panel, callout, selectEl);
      el.addEventListener("click", activate);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      });
      el.addEventListener("mouseenter", () => {
        callout.textContent = `${p.name} · 未使用 ${p.unusedCpu}%`;
      });
    });

    const selected = prefs.get(selectEl?.value) || prefs.get("tokyo") || window.YAOYOROZU_PREFECTURES[0];
    selectPref(selected, svg, panel, callout, selectEl);

    if (selectEl) {
      selectEl.addEventListener("change", () => {
        const p = prefs.get(selectEl.value);
        if (p) selectPref(p, svg, panel, callout, selectEl);
      });
    }
  }

  window.YaoyorozuMap = { render: renderMap };
})();
