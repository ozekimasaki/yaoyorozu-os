import { apps, launch, openPath, getWm } from "../runtime.js";
import { guessIcon, iconMark } from "../icons.js";

export function bindTorii(gate, kernel) {
  const search = gate.querySelector("#torii-search");
  const list = gate.querySelector("#torii-list");
  let items = [];
  let cursor = 0;
  let lastSig = "";
  let findCache = { q: "", rows: [] };
  let grepCache = { q: "", rows: [] };
  let drawGen = 0;

  function catalog(q) {
    const query = (q || "").trim();
    const rows = [];
    const wm = getWm();
    if (wm) {
      for (const w of wm.list().filter((x) => !x.el.classList.contains("is-away"))) {
        rows.push({ kind: "win", id: String(w.pid), title: w.title, hint: `\u7a93 ${w.appId}`, icon: w.appId });
      }
    }
    for (const app of apps()) {
      rows.push({ kind: "app", id: app.id, title: app.title, hint: "\u304f\u3050\u308b", icon: app.id });
    }
    for (const p of kernel.state.prefs) {
      rows.push({ kind: "space", id: p.id, title: p.name, hint: "\u7a7a\u9593" });
    }
    for (const k of kernel.state.processes.filter((p) => p.kind === "authored").slice(0, 20)) {
      rows.push({ kind: "kami", id: k.id, title: k.name, hint: k.role });
    }
    for (const r of (kernel.state.recent || []).slice(0, 8)) {
      rows.push({ kind: "recent", id: r.path, title: r.path.split("/").pop() || r.path, hint: r.path });
    }
    rows.push(
      { kind: "file", id: "/etc/\u5ba3\u8a00.yaoyorozu", title: "\u5ba3\u8a00", hint: "/etc" },
      { kind: "file", id: "/etc/ofuda/constitution.20", title: "\u61b2\u6cd5", hint: "/etc/ofuda" },
      { kind: "file", id: "/etc/ofuda/protocols.stack", title: "\u30d7\u30ed\u30c8\u30b3\u30eb", hint: "/etc/ofuda" },
      { kind: "file", id: "/etc/\u4e09\u76f8\u96fb\u6e90.txt", title: "\u4e09\u76f8\u96fb\u6e90", hint: "/etc" },
      { kind: "file", id: "/etc/century.2100", title: "\u767e\u5e74", hint: "/etc" }
    );
    if (!query) return rows;
    return rows.filter((r) => `${r.title}${r.hint}${r.id}`.includes(query));
  }

  function rowIcon(r) {
    if (r.icon) return r.icon;
    if (r.kind === "space") return "spaces";
    if (r.kind === "kami") return "proc";
    return guessIcon({ path: r.id, name: r.title });
  }

  async function draw() {
    const gen = (drawGen += 1);
    const q = (search.value || "").trim();
    let rows = catalog(q);
    if (q.length >= 2) {
      if (findCache.q !== q) {
        try {
          const hits = await kernel.vfs.find("/", q);
          if (gen !== drawGen) return;
          const seen = new Set(rows.map((r) => r.id));
          findCache = {
            q,
            rows: hits
              .slice(0, 24)
              .filter((f) => !seen.has(f.path))
              .map((f) => ({
                kind: "file",
                id: f.path,
                title: f.name || f.path,
                hint: f.path,
              })),
          };
        } catch (err) {
          if (gen !== drawGen) return;
          findCache = { q, rows: [] };
        }
      }
      if (grepCache.q !== q) {
        try {
          const greps = await kernel.vfs.grep("/", q);
          if (gen !== drawGen) return;
          grepCache = {
            q,
            rows: greps.slice(0, 16).map((line) => {
              const i = line.indexOf(": ");
              const path = i >= 0 ? line.slice(0, i) : line;
              const hint = i >= 0 ? line.slice(i + 2) : "";
              return {
                kind: "grep",
                id: path,
                title: path.split("/").pop() || path,
                hint: hint || path,
              };
            }),
          };
        } catch (err) {
          if (gen !== drawGen) return;
          grepCache = { q, rows: [] };
        }
      }
      const seen = new Set(rows.map((r) => r.id));
      for (const r of findCache.rows) {
        if (!seen.has(r.id)) {
          rows.push(r);
          seen.add(r.id);
        }
      }
      for (const r of grepCache.rows) {
        if (!seen.has(r.id)) {
          rows.push(r);
          seen.add(r.id);
        }
      }
    }
    if (gen !== drawGen) return;
    items = rows;
    cursor = Math.min(cursor, Math.max(0, items.length - 1));
    const sig = items.map((r) => `${r.kind}:${r.id}`).join("\n");
    if (sig === lastSig && list.children.length) {
      list.querySelectorAll(".torii-item").forEach((btn, i) => {
        btn.classList.toggle("is-on", i === cursor);
      });
      return;
    }
    lastSig = sig;
    if (!list.dataset.bound) {
      list.dataset.bound = "1";
      list.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-i]");
        if (btn) enter(items[Number(btn.dataset.i)]);
      });
    }
    list.innerHTML = items
      .map(
        (r, i) =>
          `<button type="button" class="torii-item${i === cursor ? " is-on" : ""}" data-i="${i}">${iconMark(rowIcon(r))}<span class="torii-copy"><strong>${r.title}</strong><small>${r.hint} \u00b7 ${r.kind}</small></span></button>`
      )
      .join("");
  }

  function enter(item) {
    if (!item) return;
    close();
    if (item.kind === "win") {
      const wm = getWm();
      const pid = Number(item.id);
      if (wm && pid) {
        wm.restore(pid);
        wm.focus(pid);
      }
      return;
    }
    if (item.kind === "app") launch(item.id);
    else if (item.kind === "space") {
      kernel.setSpace(item.id);
      launch("map");
    } else if (item.kind === "kami") launch("proc");
    else if (item.kind === "file" || item.kind === "recent" || item.kind === "grep") openPath(item.id);
  }

  function open() {
    gate.classList.add("open");
    search.value = "";
    cursor = 0;
    draw();
    search.focus();
    kernel.log("torii open \u2014 \u623b\u308b\u6a29\u5229\u3042\u308a", "torii");
  }

  function close() {
    gate.classList.remove("open");
  }

  search.addEventListener("input", () => {
    cursor = 0;
    draw();
  });
  search.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = Math.min(items.length - 1, cursor + 1);
      draw();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = Math.max(0, cursor - 1);
      draw();
    }
    if (e.key === "Home") {
      e.preventDefault();
      cursor = 0;
      draw();
    }
    if (e.key === "End") {
      e.preventDefault();
      cursor = Math.max(0, items.length - 1);
      draw();
    }
    if (e.key === "PageDown") {
      e.preventDefault();
      cursor = Math.min(items.length - 1, cursor + 8);
      draw();
    }
    if (e.key === "PageUp") {
      e.preventDefault();
      cursor = Math.max(0, cursor - 8);
      draw();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      enter(items[cursor]);
    }
  });

  gate.addEventListener("click", (e) => {
    if (e.target === gate) close();
  });

  return { open, close, isOpen: () => gate.classList.contains("open") };
}
