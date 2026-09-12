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

export default {
  id: "map",
  title: "列島",
  width: "min(980px, 92vw)",
  height: "min(720px, 82vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    el.className = "map-wrap";
    el.innerHTML = `
      <div class="map-stage">
        <div class="map-chrome">
          <div class="map-kicker">列島カーネル · 47 · 空間=${kernel.spacePref().name}</div>
          <div class="map-callout" id="map-callout">県を選べ</div>
        </div>
        <div class="map-canvas" id="japan-map-host"><p class="muted" style="padding:24px">列島を呼び出している…</p></div>
        <div class="map-legend"><span class="lg cool">余白</span><span class="lg mid">中</span><span class="lg hot">過密</span></div>
      </div>
      <aside class="map-panel">
        <label class="map-select-label">都道府県
          <select id="map-select"></select>
        </label>
        <div id="map-panel"></div>
        <p class="map-attr">地図: MapSVG / @svg-maps/japan · CC BY 4.0</p>
      </aside>
    `;

    const host = el.querySelector("#japan-map-host");
    const panel = el.querySelector("#map-panel");
    const callout = el.querySelector("#map-callout");
    const selectEl = el.querySelector("#map-select");
    const kicker = el.querySelector(".map-kicker");
    let svg = null;
    let lastPaint = "";
    let lastPanel = "";
    let viewId = kernel.state.currentSpace;
    let typeQ = "";
    let typeT = 0;

    kernel.state.prefs.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.code || ""} ${p.name}`;
      selectEl.appendChild(opt);
    });

    function prefOf(id) {
      return kernel.state.prefs.find((x) => x.id === id) || kernel.spacePref();
    }

    function panelHtml(p) {
      const live = prefOf(p.id);
      return `
        <div class="tag">${live.region} / ${live.code || ""} / 未使用CPU ${live.unusedCpu}%</div>
        <h2>${live.name}</h2>
        <p class="muted">${live.kami}</p>
        <p>${live.protocol}</p>
        <p class="muted">特技: ${live.specialty}<br>危機: ${live.crisis}<br>機会: ${live.opportunity}</p>
        <p>季節: ${live.season} / 縁: ${live.en.toLocaleString("ja-JP")}</p>
        <p class="muted">この県は親プロセスではない。くぐると、このカーネルの空間へ移る。</p>
        <button class="btn primary" type="button" data-enter="${live.id}">この空間へ</button>
      `;
    }

    function paint() {
      if (!svg) return;
      const sig = `${kernel.state.currentSpace}|${viewId}|${kernel.state.prefs.map((p) => `${p.id}:${p.unusedCpu | 0}`).join(",")}`;
      if (sig === lastPaint && svg.querySelector(".is-selected")) return;
      lastPaint = sig;
      svg.querySelectorAll(".pref").forEach((node) => {
        const p = kernel.state.prefs.find((x) => x.id === node.dataset.pref);
        if (!p) return;
        node.classList.remove("cool", "mid", "hot");
        node.classList.add(heatKind(p.unusedCpu));
        node.style.setProperty("--land", landColor(p.unusedCpu));
        node.classList.toggle("is-selected", p.id === kernel.state.currentSpace);
        node.classList.toggle("is-view", p.id === viewId);
      });
      kicker.textContent = `列島カーネル · 47 · 空間=${kernel.spacePref().name}`;
    }

    function select(p, enter) {
      if (!p) return;
      viewId = p.id;
      if (lastPanel !== p.id || !panel.querySelector("[data-enter]")) {
        lastPanel = p.id;
        panel.innerHTML = panelHtml(p);
        const btn = panel.querySelector("[data-enter]");
        if (btn) btn.onclick = () => kernel.setSpace(p.id);
      }
      callout.textContent = `${p.name} · 未使用 ${p.unusedCpu}%`;
      if (selectEl.value !== p.id) selectEl.value = p.id;
      paint();
      if (enter) kernel.setSpace(p.id);
    }

    function moveView(dir) {
      const list = kernel.state.prefs;
      if (!list.length) return;
      let i = list.findIndex((p) => p.id === viewId);
      if (i < 0) i = 0;
      i = (i + dir + list.length) % list.length;
      select(list[i], false);
    }

    function jumpName(ch) {
      if (typeT) clearTimeout(typeT);
      typeQ += ch;
      typeT = setTimeout(() => {
        typeQ = "";
        typeT = 0;
      }, 800);
      const needle = typeQ.toLowerCase();
      const list = kernel.state.prefs;
      const cur = Math.max(0, list.findIndex((p) => p.id === viewId));
      for (let n = 1; n <= list.length; n += 1) {
        const p = list[(cur + n) % list.length];
        const keys = `${p.name}\n${p.id}\n${p.code || ""}\n${p.kami || ""}`.toLowerCase();
        if (keys.split("\n").some((k) => k.startsWith(needle))) {
          select(p, false);
          return;
        }
      }
    }

    async function load() {
      const sources = [
        new URL("../../svg/japan-prefectures.svg", import.meta.url).href,
        new URL("svg/japan-prefectures.svg", document.baseURI).href,
        "https://cdn.jsdelivr.net/npm/@svg-maps/japan@2.0.0/japan.svg",
      ];
      for (const href of sources) {
        try {
          const res = await fetch(href);
          if (!res.ok) continue;
          host.innerHTML = await res.text();
          break;
        } catch (err) {
          /* next */
        }
      }
      svg = host.querySelector("svg");
      if (!svg) {
        panel.innerHTML = `<p class="muted">列島の地図を呼べなかった。</p>`;
        return;
      }
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.classList.add("japan-map");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.querySelectorAll("path[id]").forEach((node) => {
        if (!node.dataset.pref) node.dataset.pref = node.id;
        node.classList.add("pref");
        node.tabIndex = -1;
        const p = kernel.state.prefs.find((x) => x.id === node.dataset.pref);
        if (!p) return;
        node.addEventListener("click", () => select(p, false));
        node.addEventListener("mouseenter", () => {
          callout.textContent = `${p.name} · 未使用 ${p.unusedCpu}%`;
        });
      });
      selectEl.onchange = () => {
        const p = kernel.state.prefs.find((x) => x.id === selectEl.value);
        if (p) select(p, false);
      };
      select(kernel.spacePref(), false);
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        moveView(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        moveView(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        select(kernel.spacePref(), false);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        kernel.setSpace(viewId);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        jumpName(e.key);
      }
    });

    const onSpot = (ev) => {
      const id = ev.detail;
      const p = kernel.state.prefs.find((x) => x.id === id);
      if (p) select(p, false);
    };
    const onSpace = () => {
      viewId = kernel.state.currentSpace;
      const p = kernel.spacePref();
      if (lastPanel !== p.id) select(p, false);
      else paint();
    };
    kernel.addEventListener("spotlight", onSpot);
    kernel.addEventListener("space", onSpace);
    load();

    return {
      el,
      title: "列島.map",
      width: "min(980px, 92vw)",
      height: "min(720px, 82vh)",
      onFocus() {
        if (document.activeElement && (document.activeElement.tagName === "SELECT" || document.activeElement.tagName === "INPUT")) {
          return;
        }
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("spotlight", onSpot);
        kernel.removeEventListener("space", onSpace);
      },
    };
  },
};
