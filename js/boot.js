(function () {
  const bootLines = [
    "YAOYOROZU-OS BIOS 0.1",
    "detecting shrines ........................ 80,431",
    "mounting kami namespace ................... ok",
    "linking 47 prefecture kernels .............. ok",
    "warning: 無縁 packets 23.4%",
    "warning: Tokyo CPU 88% / local kami swapped out",
    "loading 言霊 daemon ....................... ok",
    "season API ............................... 晩夏",
    "dead seats in parliament ................... reserved",
    "starting 注連縄 firewall ................... deny-by-default",
    "ready.",
    "",
    "神はマイクロサービスである。",
    "未開封の日本を、起動しますか。",
  ];

  const log = document.getElementById("boot-log");
  const boot = document.getElementById("boot");
  const desktop = document.getElementById("desktop");
  let i = 0;
  let skipped = false;

  function writeNext() {
    if (skipped) return;
    if (i >= bootLines.length) {
      document.getElementById("boot-ready").hidden = false;
      return;
    }
    log.textContent += bootLines[i] + "\n";
    i += 1;
    setTimeout(writeNext, i < 10 ? 90 : 160);
  }

  window.bootYaoyorozu = function startDesktop() {
    skipped = true;
    boot.classList.add("hidden");
    desktop.classList.add("on");
    if (window.YaoyorozuApp) window.YaoyorozuApp.start();
  };

  document.getElementById("boot-start").addEventListener("click", window.bootYaoyorozu);
  document.getElementById("boot-skip").addEventListener("click", window.bootYaoyorozu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !desktop.classList.contains("on")) window.bootYaoyorozu();
  });

  writeNext();
})();
