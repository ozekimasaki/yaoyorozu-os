const IDS = [
  "oncall",
  "torii",
  "home",
  "fs",
  "term",
  "map",
  "proc",
  "cal",
  "sys",
  "muen",
  "oto",
  "editor",
  "clip",
  "fw",
  "net",
  "ma",
  "sim",
  "dmesg",
  "ofuda",
  "box",
  "kashiwa",
  "silent",
  "spaces",
];

const KNOWN = new Set(IDS);

const NAMES = {
  "\u5f53\u76f4": "oncall",
  "\u5217\u5cf6": "map",
  "\u795e": "proc",
  "\u7e01fs": "fs",
  "\u5949\u7d0d": "term",
  "\u796d\u66a6": "cal",
  "\u6a5f\u68b0": "sys",
  "\u7121\u7e01": "muen",
  "\u97f3\u970a": "oto",
  "\u8a00\u970a": "editor",
  "\u63a7\u3048": "clip",
  "\u6ce8\u9023\u7e04": "fw",
  "\u7e01": "net",
  "\u9593": "ma",
  "1000\u65e5": "sim",
  dmesg: "dmesg",
  "\u9ce5\u5c45": "torii",
  "\u30db\u30fc\u30e0": "home",
  "\u67cf\u624b": "kashiwa",
  "\u6c88\u9ed9": "silent",
  "\u7a7a\u9593": "spaces",
};

const EXT = {
  oto: "oto",
  kagura: "oto",
  wav: "oto",
  mp3: "oto",
  ogg: "oto",
  m4a: "oto",
  webm: "oto",
  mp4: "oto",
  gate: "torii",
  yaoyorozu: "ofuda",
  ofuda: "ofuda",
  cal: "cal",
  clip: "clip",
};

export function knownIcon(id) {
  return KNOWN.has(id) ? id : "ofuda";
}

export function guessIcon(file) {
  const path = (file && (file.path || file.name)) || "";
  const raw = (file && file.name) || String(path).split("/").pop() || "";
  const stem = raw.replace(/\.gate$/i, "");
  if (NAMES[stem]) return NAMES[stem];
  if (KNOWN.has(stem)) return stem;
  const body = String((file && file.body) || "").trim();
  if (KNOWN.has(body)) return body;
  const ext = stem.includes(".") ? stem.split(".").pop().toLowerCase() : "";
  if (EXT[ext]) return EXT[ext];
  const mime = String((file && file.mime) || "");
  if (mime.startsWith("audio/") || mime.startsWith("video/") || mime === "text/oto") return "oto";
  if (mime === "gate/app") return body && KNOWN.has(body) ? body : "torii";
  if (file && file.type === "dir") return "box";
  return "ofuda";
}

export function iconSrc(id) {
  return `icons/${knownIcon(id)}.svg`;
}

export function iconMark(id) {
  const key = knownIcon(id);
  return (
    `<span class="fuda-mark" data-icon="${key}" aria-hidden="true">` +
    `<img src="icons/${key}.svg" alt="" width="32" height="32" draggable="false">` +
    `</span>`
  );
}

export function iconNode(id) {
  const key = knownIcon(id);
  const wrap = document.createElement("span");
  wrap.className = "fuda-mark";
  wrap.dataset.icon = key;
  wrap.setAttribute("aria-hidden", "true");
  const img = document.createElement("img");
  img.src = `icons/${key}.svg`;
  img.alt = "";
  img.width = 32;
  img.height = 32;
  img.draggable = false;
  wrap.appendChild(img);
  return wrap;
}

export function labelWithIcon(el, id, text) {
  if (!el) return;
  const key = knownIcon(id);
  [...el.childNodes].forEach((n) => {
    if (n.nodeType === 3) n.remove();
  });
  let mark = el.querySelector(":scope > .fuda-mark");
  if (!mark || mark.dataset.icon !== key) {
    el.querySelectorAll(":scope > .fuda-mark").forEach((n) => n.remove());
    mark = iconNode(key);
    el.insertBefore(mark, el.firstChild);
  }
  let name = el.querySelector(":scope > .fuda-name");
  if (!name) {
    name = document.createElement("span");
    name.className = "fuda-name";
    el.appendChild(name);
  }
  const next = text == null ? "" : String(text);
  if (name.textContent !== next) name.textContent = next;
}

export function iconIds() {
  return IDS.slice();
}
