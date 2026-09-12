export const ICONS = {
  oncall: "/icons/oncall.svg",
  map: "/icons/map.svg",
  proc: "/icons/proc.svg",
  fs: "/icons/fs.svg",
  editor: "/icons/editor.svg",
  fw: "/icons/fw.svg",
  net: "/icons/net.svg",
  dmesg: "/icons/dmesg.svg",
  term: "/icons/term.svg",
  sim: "/icons/sim.svg",
  ma: "/icons/ma.svg",
  cal: "/icons/cal.svg",
  clip: "/icons/clip.svg",
  sys: "/icons/sys.svg",
  muen: "/icons/muen.svg",
  oto: "/icons/oto.svg",
  watari: "/icons/watari.svg",
  kagami: "/icons/kagami.svg",
  utsushi: "/icons/utsushi.svg",
};

export const ICON_LABELS = {
  oncall: "当直",
  map: "列島",
  proc: "神",
  fs: "縁fs",
  editor: "言霊",
  fw: "注連縄",
  net: "縁",
  dmesg: "言の帳",
  term: "奉納",
  sim: "1000日",
  ma: "間",
  cal: "祭暦",
  clip: "控え",
  sys: "機械",
  muen: "無縁",
  oto: "音霊",
  watari: "渡り",
  kagami: "鏡",
  utsushi: "写し",
};

export function iconUrl(id) {
  return ICONS[id] || ICONS.fs;
}

export function iconLabel(id) {
  return ICON_LABELS[id] || id;
}

export function iconHtml(id, extraClass = "") {
  const src = iconUrl(id);
  const label = iconLabel(id);
  const cls = extraClass ? `kami-icon ${extraClass}` : "kami-icon";
  return `<img class="${cls}" src="${src}" alt="${label}" width="32" height="32" decoding="async">`;
}
