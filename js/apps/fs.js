const VIRTUAL = new Set(["/proc/kami", "/proc/pref", "/var/dmesg"]);

function isVirtual(path) {
  return (
    VIRTUAL.has(path) ||
    path.startsWith("/proc/") ||
    path.startsWith("/var/dmesg") ||
    path.includes("/shrines")
  );
}

export default {
  id: "fs",
  title: "縁fs",
  width: "min(860px, 90vw)",
  height: "min(580px, 76vh)",
  spawn({ kernel, launch, path: startPath }) {
    const el = document.createElement("div");
    let cwd = startPath || "/";
    let selected = "";
    let lastSig = "";
    let hist = [cwd];
    let histI = 0;
    let usedCache = { sig: "", text: "" };
    let sortKey = "name";

    function pushCwd(p) {
      if (p === hist[histI]) return;
      hist = hist.slice(0, histI + 1);
      hist.push(p);
      histI = hist.length - 1;
    }

    function back() {
      if (histI <= 0) return;
      histI -= 1;
      cwd = hist[histI];
      selected = "";
      render();
    }

    function forward() {
      if (histI >= hist.length - 1) return;
      histI += 1;
      cwd = hist[histI];
      selected = "";
      render();
    }

    function uniqueName(name, taken) {
      if (!taken.has(name)) return name;
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let i = 2;
      while (taken.has(`${stem}-${i}${ext}`)) i += 1;
      return `${stem}-${i}${ext}`;
    }

    async function ingest(paths) {
      if (isVirtual(cwd)) {
        kernel.log("仮想匣には落とせない", "fs");
        return;
      }
      let rows = [];
      try {
        rows = await kernel.vfs.ls(cwd);
      } catch (err) {
        rows = [];
      }
      const taken = new Set(rows.map((r) => r.name));
      let n = 0;
      for (const src of paths || []) {
        const name = uniqueName(kernel.vfs.nameOf(src), taken);
        taken.add(name);
        const dest = kernel.vfs.normalize(`${cwd}/${name}`);
        try {
          await kernel.vfs.copyTree(src, dest);
          kernel.noteRecent(dest);
          n += 1;
        } catch (e) {
          kernel.log(`落とす: ${e.message}`, "fs");
        }
      }
      if (n) {
        kernel.emit("vfs");
        kernel.log(`縁fsに落とした ×${n}`, "fs");
      }
    }

    function sortEntries(rows) {
      const copy = [...rows];
      if (sortKey === "updated") {
        copy.sort((a, b) => (b.updated || 0) - (a.updated || 0) || (a.name || "").localeCompare(b.name || "", "ja"));
      } else {
        copy.sort((a, b) => (a.name || "").localeCompare(b.name || "", "ja"));
      }
      return copy;
    }

    function moveSel(delta) {
      const btns = [...el.querySelectorAll(".fs-tree [data-path]")];
      if (!btns.length) return;
      let i = btns.findIndex((b) => b.dataset.path === selected);
      if (i < 0) i = 0;
      else i = (i + delta + btns.length) % btns.length;
      selected = btns[i].dataset.path || "";
      btns.forEach((b) => b.classList.toggle("is-on", b.dataset.path === selected));
      btns[i].focus();
    }

    async function goPath(raw) {
      const dest = kernel.vfs.normalize(raw || "/");
      try {
        const node = await kernel.vfs.getFile(dest);
        if (node && node.type !== "dir" && dest !== "/") {
          return openPath(dest, node.type);
        }
      } catch (err) {
        if (dest !== "/") {
          kernel.log(`cwd: ${err.message}`, "fs");
          return;
        }
      }
      cwd = dest;
      selected = "";
      pushCwd(dest);
      render();
    }

    async function virtualListing(path) {
      if (path === "/proc/kami") {
        return kernel.state.processes
          .filter((p) => p.kind !== "app")
          .slice(0, 80)
          .map((p) => ({ name: `${p.id}.proc`, path: `/proc/kami/${p.id}`, type: "file" }));
      }
      if (path === "/proc/pref") {
        return kernel.state.prefs.map((p) => ({
          name: p.id,
          path: `/mnt/${p.id}`,
          type: "dir",
        }));
      }
      if (path === "/var/dmesg") {
        return [{ name: "current", path: "/var/dmesg/current", type: "file" }];
      }
      if (path.startsWith("/mnt/") && path.endsWith("/shrines")) {
        const prefId = path.split("/")[2];
        const { rows } = kernel.listShrines(prefId, 0, 50);
        return rows.map((r) => ({ name: r.name, path: r.path, type: "file" }));
      }
      return null;
    }

    async function openPath(p, type) {
      if (type === "dir" || p.split("/").filter(Boolean).length < 2 || VIRTUAL.has(p) || p.endsWith("/shrines")) {
        cwd = p;
        selected = "";
        pushCwd(p);
        render();
        return;
      }
      kernel.noteRecent(p);
      if (type === "link") {
        const node = await kernel.vfs.getFile(p);
        if (node && node.target) {
          const dest = await kernel.vfs.getFile(node.target);
          return openPath(node.target, dest ? dest.type : "file");
        }
      }
      if (p.endsWith(".gate")) {
        const f = await kernel.readPath(p);
        launch(f.body.trim());
        return;
      }
      launch("editor", { path: p });
    }

    async function render() {
      let entries = [];
      let err = "";
      try {
        entries = (await virtualListing(cwd)) || (await kernel.listPath(cwd));
      } catch (e) {
        err = e.message;
      }
      const parent = kernel.vfs.parentOf(cwd);
      const locked = isVirtual(cwd);
      entries = sortEntries(entries);
      const listSig = `${cwd}\n${err}\n${locked}\n${sortKey}\n${entries.map((f) => `${f.type}:${f.path}`).join("\n")}`;
      if (listSig === lastSig && el.querySelector(".fs-tree")) {
        el.querySelectorAll("[data-path]").forEach((b) => b.classList.toggle("is-on", b.dataset.path === selected));
        return;
      }
      lastSig = listSig;
      let used = usedCache.text;
      if (locked) {
        used = "";
        usedCache = { sig: listSig, text: used };
      } else if (usedCache.sig !== listSig) {
        try {
          const u = await kernel.vfs.usage(cwd);
          used = ` · ${u.files}札 ${u.bytes}B`;
        } catch (e) {
          used = "";
        }
        usedCache = { sig: listSig, text: used };
      }
      el.innerHTML = `
        <p class="muted">cwd ${cwd}${used}${err ? ` · ${err}` : ""}</p>
        <input class="search" id="fs-go" value="${cwd}" aria-label="匣の道" style="margin:8px 0;max-width:100%" />
        <div class="fs-tree">
          ${cwd !== "/" ? `<button type="button" data-path="${parent}" data-type="dir">../</button>` : ""}
          ${entries
            .map(
              (f) =>
                `<button type="button" class="${f.path === selected ? "is-on" : ""}" data-path="${f.path}" data-type="${f.type}">${f.type === "dir" ? "▸" : f.type === "link" ? "↦" : "·"} ${f.name || f.path}</button>`
            )
            .join("")}
        </div>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start;flex-wrap:wrap">
          <button class="btn" type="button" id="fs-back" ${histI <= 0 ? "disabled" : ""}>戻る</button>
          <button class="btn" type="button" id="fs-fwd" ${histI >= hist.length - 1 ? "disabled" : ""}>進む</button>
          <button class="btn" type="button" id="fs-sort">${sortKey === "updated" ? "時順" : "名順"}</button>
          <input class="search" id="fs-name" placeholder="匣の名 / 新しい名" ${locked ? "disabled" : ""} style="margin:0;max-width:200px" />
          <button class="btn" type="button" id="fs-mkdir" ${locked ? "disabled" : ""}>匣を作る</button>
          <button class="btn" type="button" id="fs-new" ${locked ? "disabled" : ""}>札を作る</button>
          <button class="btn" type="button" id="fs-copy" ${locked ? "disabled" : ""}>写す</button>
          <button class="btn" type="button" id="fs-link" ${locked ? "disabled" : ""}>結ぶ</button>
          <button class="btn" type="button" id="fs-rename" ${locked ? "disabled" : ""}>改名</button>
          <button class="btn" type="button" id="fs-muen" ${locked ? "disabled" : ""}>無縁へ</button>
          <button class="btn" type="button" id="fs-restore" ${cwd === "/var/muen" ? "" : "disabled"}>席へ戻す</button>
          <button class="btn" type="button" id="muen-scan">無縁スキャン</button>
        </div>
      `;
      el.querySelectorAll("[data-path]").forEach((btn) => {
        btn.onclick = () => {
          const p = btn.dataset.path;
          const type = btn.dataset.type;
          if (type === "dir") {
            openPath(p, type);
            return;
          }
          selected = p;
          el.querySelectorAll("[data-path]").forEach((b) => b.classList.toggle("is-on", b.dataset.path === p));
        };
        btn.ondblclick = () => openPath(btn.dataset.path, btn.dataset.type);
      });
      el.querySelector("#fs-back").onclick = () => back();
      el.querySelector("#fs-fwd").onclick = () => forward();
      el.querySelector("#fs-sort").onclick = () => {
        sortKey = sortKey === "name" ? "updated" : "name";
        lastSig = "";
        render();
      };
      const goEl = el.querySelector("#fs-go");
      goEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          goPath(goEl.value.trim());
        }
      });
      const nameEl = el.querySelector("#fs-name");
      el.querySelector("#fs-new").onclick = async () => {
        const name = (nameEl.value || `${Date.now()}.ofuda`).trim();
        const dest = kernel.vfs.normalize(`${cwd}/${name.includes(".") ? name : `${name}.ofuda`}`);
        try {
          await kernel.vfs.write(dest, "");
          kernel.noteRecent(dest);
          kernel.emit("vfs");
          launch("editor", { path: dest });
        } catch (e) {
          kernel.log(`write: ${e.message}`, "fs");
        }
      };
      el.querySelector("#fs-mkdir").onclick = async () => {
        const name = (nameEl.value || "").trim();
        if (!name) return;
        try {
          await kernel.vfs.mkdir(kernel.vfs.normalize(`${cwd}/${name}`));
          kernel.emit("vfs");
        } catch (e) {
          err = e.message;
          render();
        }
      };
      el.querySelector("#fs-link").onclick = async () => {
        const name = (nameEl.value || "").trim();
        if (!selected || !name) return;
        try {
          const dest = kernel.vfs.normalize(`${cwd}/${name}`);
          await kernel.vfs.link(selected, dest);
          kernel.noteRecent(dest);
          kernel.emit("vfs");
        } catch (e) {
          kernel.log(`ln: ${e.message}`, "fs");
        }
      };
      el.querySelector("#fs-copy").onclick = async () => {
        const name = (nameEl.value || "").trim();
        if (!selected || !name) return;
        try {
          const dest = kernel.vfs.normalize(`${cwd}/${name}`);
          await kernel.vfs.copy(selected, dest);
          kernel.noteRecent(dest);
          kernel.emit("vfs");
        } catch (e) {
          kernel.log(`cp: ${e.message}`, "fs");
        }
      };
      el.querySelector("#fs-rename").onclick = async () => {
        const name = (nameEl.value || "").trim();
        if (!selected || !name) return;
        try {
          const dest = kernel.vfs.normalize(`${cwd}/${name}`);
          await kernel.vfs.rename(selected, dest);
          kernel.noteRecent(dest);
          selected = dest;
          kernel.emit("vfs");
        } catch (e) {
          kernel.log(`rename: ${e.message}`, "fs");
        }
      };
      el.querySelector("#fs-muen").onclick = async () => {
        if (!selected) return;
        try {
          const dest = await kernel.vfs.moveToMuen(selected);
          kernel.log(`無縁へ ${selected} → ${dest}`, "fs");
          selected = "";
          kernel.emit("vfs");
        } catch (e) {
          kernel.log(`muen: ${e.message}`, "fs");
        }
      };
      el.querySelector("#fs-restore").onclick = async () => {
        if (!selected) return;
        try {
          const dest = await kernel.vfs.restoreFromMuen(selected);
          kernel.log(`restore ${selected} → ${dest}`, "fs");
          kernel.noteRecent(dest);
          selected = "";
          kernel.emit("vfs");
        } catch (e) {
          kernel.log(`restore: ${e.message}`, "fs");
        }
      };
      el.querySelector("#muen-scan").onclick = () => {
        kernel.spawnMuen("スキャンで見つかった点");
        kernel.log("無縁スキャン: 提案だけする。強制友情はしない", "muen");
      };
    }

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.altKey && e.key === "ArrowLeft") {
        e.preventDefault();
        back();
        return;
      }
      if (e.altKey && e.key === "ArrowRight") {
        e.preventDefault();
        forward();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        const go = el.querySelector("#fs-go");
        if (go) {
          go.focus();
          go.select();
        }
        return;
      }
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSel(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSel(-1);
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        const btn = [...el.querySelectorAll(".fs-tree [data-path]")].find((b) => b.dataset.path === selected);
        openPath(selected, btn ? btn.dataset.type : "file");
      } else if (e.key === "Backspace" && cwd !== "/") {
        e.preventDefault();
        openPath(kernel.vfs.parentOf(cwd), "dir");
      } else if (e.key === " ") {
        e.preventDefault();
        kernel.emit("peek", selected || cwd);
      }
    });
    render();
    const on = () => render();
    kernel.addEventListener("vfs", on);
    return {
      el,
      title: "en.fs",
      onDrop(paths) {
        ingest(paths);
      },
      onClose() {
        kernel.removeEventListener("vfs", on);
      },
    };
  },
};
