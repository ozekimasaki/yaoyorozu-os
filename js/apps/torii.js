import { apps, launch, openPath } from "../runtime.js";

export function bindTorii(gate, kernel) {
  const search = gate.querySelector("#torii-search");
  const list = gate.querySelector("#torii-list");
  let items = [];
  let cursor = 0;

  function catalog(q) {
    const query = (q || "").trim();
    const rows = [];
    for (const app of apps()) {
      rows.push({ kind: "app", id: app.id, title: app.title, hint: "くぐる" });
    }
    for (const p of kernel.state.prefs) {
      rows.push({ kind: "space", id: p.id, title: p.name, hint: "空間" });
    }
    for (const k of kernel.state.processes.filter((p) => p.kind === "authored").slice(0, 20)) {
      rows.push({ kind: "kami", id: k.id, title: k.name, hint: k.role });
    }
    for (const r of (kernel.state.recent || []).slice(0, 8)) {
      rows.push({ kind: "recent", id: r.path, title: r.path.split("/").pop() || r.path, hint: r.path });
    }
    rows.push(
      { kind: "file", id: "/etc/宣言.yaoyorozu", title: "宣言", hint: "/etc" },
      { kind: "file", id: "/etc/ofuda/constitution.20", title: "憲法", hint: "/etc/ofuda" },
      { kind: "file", id: "/etc/ofuda/protocols.stack", title: "プロトコル", hint: "/etc/ofuda" },
      { kind: "file", id: "/etc/三相電源.txt", title: "三相電源", hint: "/etc" },
      { kind: "file", id: "/etc/century.2100", title: "百年", hint: "/etc" }
    );
    if (!query) return rows;
    return rows.filter((r) => `${r.title}${r.hint}${r.id}`.includes(query));
  }

  function draw() {
    items = catalog(search.value);
    cursor = Math.min(cursor, Math.max(0, items.length - 1));
    list.innerHTML = items
      .map(
        (r, i) =>
          `<button type="button" class="torii-item${i === cursor ? " is-on" : ""}" data-i="${i}"><strong>${r.title}</strong><small>${r.hint} · ${r.kind}</small></button>`
      )
      .join("");
    list.querySelectorAll(".torii-item").forEach((btn) => {
      btn.onclick = () => enter(items[Number(btn.dataset.i)]);
    });
  }

  function enter(item) {
    if (!item) return;
    close();
    if (item.kind === "app") launch(item.id);
    else if (item.kind === "space") {
      kernel.setSpace(item.id);
      launch("map");
    } else if (item.kind === "kami") launch("proc");
    else if (item.kind === "file" || item.kind === "recent") openPath(item.id);
  }

  function open() {
    gate.classList.add("open");
    search.value = "";
    cursor = 0;
    draw();
    search.focus();
    kernel.log("torii open — 戻る権利あり", "torii");
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
