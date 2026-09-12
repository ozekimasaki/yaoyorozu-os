const VIRTUAL = new Set(["/proc/kami", "/proc/pref", "/var/dmesg"]);

function isVirtual(path) {
  return (
    VIRTUAL.has(path) ||
    path.startsWith("/proc/") ||
    path.startsWith("/var/dmesg") ||
    path.includes("/shrines")
  );
}
