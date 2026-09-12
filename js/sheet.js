import { listHandlers, sharePath, shareTargets, openPath } from "./runtime.js";

const LABELS = {
  editor: "\u8a00\u970a",
  fs: "\u7e01fs",
  term: "\u5949\u7d0d",
  clip: "\u63a7\u3048",
  cal: "\u796d\u66a6",
  muen: "\u7121\u7e01",
  oncall: "\u5f53\u76f4",
};

let host = null;
let track = null;
let kicker = null;
let dismiss = null;

function clearDismiss() {
  if (dismiss) {
    document.removeEventListener("pointerdown", dismiss, true);
    dismiss = null;
  }
}

export function closeSheet() {
  if (host) host.hidden = true;
  clearDismiss();
}

function armDismiss() {
  clearDismiss();
  dismiss = (e) => {
    if (host && !host.hidden && host.contains(e.target)) return;
    closeSheet();
  };
  setTimeout(() => {
    if (dismiss) document.addEventListener("pointerdown", dismiss, true);
  }, 0);
}

function paintItems(title, items) {
  if (!host || !track) return;
  if (kicker) kicker.textContent = title || "\u672d";
  track.replaceChildren();
  for (const item of items) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = item.label;
    for (const [k, v] of Object.entries(item.attrs || {})) b.dataset[k] = String(v);
    track.appendChild(b);
  }
  host.hidden = false;
  armDismiss();
}

export function bindSheet() {
  host = document.getElementById("os-sheet");
  track = document.getElementById("os-sheet-track");
  kicker = document.getElementById("os-sheet-kicker");
  if (!host || !track) return { close: closeSheet };
  host.addEventListener("click", async (e) => {
    e.stopPropagation();
    const btn = e.target.closest("button");
    if (!btn) return;
    const path = btn.dataset.path || "";
    const withId = btn.dataset.with || "";
    const shareTo = btn.dataset.share || "";
    const act = btn.dataset.act || "";
    if (act === "close") {
      closeSheet();
      return;
    }
    if (withId && path) {
      closeSheet();
      openPath(path, { with: withId });
      return;
    }
    if (shareTo && path) {
      closeSheet();
      await sharePath(path, { to: shareTo });
      return;
    }
    if (act === "open" && path) {
      closeSheet();
      openPath(path);
    }
  });
  return { close: closeSheet, openWith: openWithSheet, openShare: openShareSheet };
}

export async function openWithSheet(path) {
  if (!host || !path) return;
  const items = [{ label: "\u304f\u3050\u308b", attrs: { act: "open", path } }];
  try {
    const rows = await listHandlers(path);
    for (const row of rows) {
      items.push({
        label: `${LABELS[row.id] || row.id}\u3067\u958b\u304f`,
        attrs: { with: row.id, path },
      });
    }
  } catch (err) {
    /* assoc */
  }
  items.push({ label: "\u9589\u3058\u308b", attrs: { act: "close" } });
  paintItems(path.split("/").pop() || path, items);
}

export async function openShareSheet(path) {
  if (!host || !path) return;
  const items = [];
  for (const id of shareTargets()) {
    items.push({
      label: `${LABELS[id] || id}\u3078\u6e21\u3059`,
      attrs: { share: id, path },
    });
  }
  items.push({ label: "\u9589\u3058\u308b", attrs: { act: "close" } });
  paintItems(`\u6e21\u3059 \u00b7 ${path.split("/").pop() || path}`, items);
}
