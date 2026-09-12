import { openPath as osOpen } from "../runtime.js";
import { openWithSheet, openShareSheet } from "../sheet.js";

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
    let selected = new Set();
    let lastFsPick = "";
    let lastSig = "";
    let hist = [cwd];
    let histI = 0;
    let usedCache = { sig: "", text: "" };
    let sortKey = "name";
    let nameFilter = "";
    let cwdTimer = 0;
    let peekSig = "";
    let peekTok = 0;
    let fsErr = "";

    function rememberCwd() {
      if (cwdTimer) clearTimeout(cwdTimer);
      cwdTimer = setTimeout(() => {
        cwdTimer = 0;
        kernel.vfs.metaSet("fsCwd", cwd);
      }, 240);
    }

    function bindAt(path) {
      const k = kernel.konoyo;
      if (!k || !path) return null;
      return k.list().find((b) => path === b.path || path.startsWith(`${b.path}/`)) || null;
    }

    function marks() {
      const home = `/home/${kernel.state.ujiko}`;
      return [
        { path: "/", name: "根" },
        { path: home, name: "氏子" },
        { path: `${home}/desktop`, name: "卓" },
        { path: "/etc", name: "式" },
        { path: "/etc/oto", name: "音" },
        { path: "/var/muen", name: "無縁" },
        { path: "/konoyo", name: "\\u6b64\\u5cb8" },
        { path: "/var/watari", name: "\\u6e21\\u308a" },
        { path: "/proc/kami", name: "神" },
      ];
    }
