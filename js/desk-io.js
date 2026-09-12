export function closeEl(id) {
  const box = document.getElementById(id);
  if (box) {
    box.hidden = true;
    box.dataset.path = "";
  }
}

export function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function kindLabel(node, path) {
  if (!node) return "無い";
  if (node.type === "dir") return "匣";
  if (node.type === "link") return "結び";
  if ((path && path.endsWith(".gate")) || node.mime === "gate/app") return "鳥居";
  return "札";
}

export async function peekPath(kernel, path) {
  const box = document.getElementById("desk-peek");
  if (!box) return;
  if (!path) {
    box.hidden = true;
    return;
  }
  if (!box.hidden && box.dataset.path === path) {
    box.hidden = true;
    return;
  }
  const title = document.getElementById("desk-peek-path");
  const body = document.getElementById("desk-peek-body");
  title.textContent = path;
  box.dataset.path = path;
  try {
    const node = path === "/" ? { type: "dir" } : await kernel.vfs.getFile(path);
    if (!node) {
      body.textContent = "ENOENT";
    } else if (node.type === "dir") {
      const kids = await kernel.vfs.ls(path);
      body.textContent = kids.map((k) => `${k.type === "dir" ? "▸" : "·"} ${k.name}`).join("\n") || "（空の匣）";
    } else if (node.type === "link") {
      body.textContent = `↦ ${node.target || node.body || ""}`;
    } else if ((path.endsWith(".gate") || node.mime === "gate/app") && node.body) {
      body.textContent = `くぐると起動: ${String(node.body).trim()}`;
    } else {
      body.textContent = String(node.body || "").split("\n").slice(0, 24).join("\n") || "（空の札）";
    }
  } catch (err) {
    body.textContent = err.message;
  }
  box.hidden = false;
}

export async function showFileStat(kernel, path) {
  const box = document.getElementById("file-stat");
  if (!box) return;
  if (!path) {
    box.hidden = true;
    return;
  }
  if (!box.hidden && box.dataset.path === path) {
    box.hidden = true;
    return;
  }
  closeEl("desk-peek");
  const title = document.getElementById("file-stat-path");
  const body = document.getElementById("file-stat-body");
  title.textContent = path;
  box.dataset.path = path;
  try {
    const node = path === "/" ? { type: "dir", mime: "inode/directory", updated: 0 } : await kernel.vfs.getFile(path);
    if (!node) {
      body.textContent = "ENOENT";
    } else {
      const lines = [`種  ${kindLabel(node, path)}`, `型  ${node.mime || "—"}`];
      if (node.type === "link") lines.push(`先  ${node.target || node.body || "—"}`);
      if (node.type === "file" || node.type === "link") {
        lines.push(`量  ${(node.body || "").length}B`);
        lines.push(`行  ${node.exec ? "くぐれる" : "読む"}`);
      }
      if (node.type === "dir") {
        try {
          const u = await kernel.vfs.usage(path);
          lines.push(`量  匣${u.dirs} · 札${u.files} · ${u.bytes}B`);
        } catch (err) {
          lines.push("量  —");
        }
      }
      if (node.origin) lines.push(`元  ${node.origin}`);
      lines.push(`時  ${fmtWhen(node.updated)}`);
      const text = lines.join("\n");
      if (body.textContent !== text) body.textContent = text;
    }
  } catch (err) {
    body.textContent = err.message;
  }
  box.hidden = false;
}

export function copyPathNow(kernel, path, tag = "desk") {
  if (!path) return;
  kernel.clipPush(path);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(path).catch(() => {});
  }
  kernel.log(`道を写した ${path}`, tag);
}
