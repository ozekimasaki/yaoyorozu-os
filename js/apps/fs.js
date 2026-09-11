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
        render();
        return;
      }
      kernel.noteRecent(p);
      if (p.endsWith(".gate")) {
        const f = await kernel.vfs.read(p);
        launch(f.body.trim());
        return;
      }
      launch("editor", { path: p });
    }

    async function render() {
      let entries = [];
      let err = "";
      try {
        entries = (await virtualListing(cwd)) || (await kernel.vfs.ls(cwd));
      } catch (e) {
        err = e.message;
      }
      const parent = kernel.vfs.parentOf(cwd);
      const locked = isVirtual(cwd);
      el.innerHTML = `
        <p class="muted">cwd ${cwd}${err ? ` · ${err}` : ""}</p>
        <div class="fs-tree">
          ${cwd !== "/" ? `<button type="button" data-path="${parent}" data-type="dir">../</button>` : ""}
          ${entries
            .map(
              (f) =>
                `<button type="button" class="${f.path === selected ? "is-on" : ""}" data-path="${f.path}" data-type="${f.type}">${f.type === "dir" ? "▸" : "·"} ${f.name || f.path}</button>`
            )
            .join("")}
        </div>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start;flex-wrap:wrap">
          <input class="search" id="fs-name" placeholder="匡の名 / 新しい名" ${locked ? "disabled" : ""} style="margin:0;max-width:200px" />
          <button class="btn" type="button" id="fs-mkdir" ${locked ? "disabled" : ""}>匡を作る</button>
          <button class="btn" type="button" id="fs-copy" ${locked ? "disabled" : ""}>写す</button>
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
      const nameEl = el.querySelector("#fs-name");
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

    render();
    const on = () => render();
    kernel.addEventListener("vfs", on);
    return {
      el,
      title: "en.fs",
      onClose() {
        kernel.removeEventListener("vfs", on);
      },
    };
  },
};
