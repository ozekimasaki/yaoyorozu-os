const COMPILE = [
  "kotodama-compiler 0.1",
  "checking left hand .................. ok",
  "checking right hand ................. ok",
  "linking 死者の席.o  余白.o  未完了.o",
  "warning: 一神教的単一障害点を検出。八百万へ分解。",
];

function suzu() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1760, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.35);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 1);
  } catch (err) {
    /* 鈴が打てない日もある */
  }
}

export function bindKashiwa(stage, kernel, onJob) {
  const log = stage.querySelector("#kashiwa-log");
  const result = stage.querySelector("#kashiwa-result");
  const left = stage.querySelector("[data-hand=left]");
  const right = stage.querySelector("[data-hand=right]");
  let struck = { left: false, right: false };
  let busy = false;

  function reset() {
    struck = { left: false, right: false };
    busy = false;
    left.classList.remove("struck");
    right.classList.remove("struck");
    log.textContent = "左手、右手の順に叩け。これは引きではない。認証である。";
    result.textContent = "";
  }

  function open() {
    reset();
    stage.classList.add("open");
  }

  function close() {
    stage.classList.remove("open");
  }

  async function compile() {
    if (busy) return;
    busy = true;
    log.textContent = "";
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const line of COMPILE) {
      log.textContent += `${line}\n`;
      if (!reduced) await new Promise((r) => setTimeout(r, 90));
    }
    const today = kernel.state.oncall.day;
    const mode = kernel.state.officialDay === today ? "reauth" : "official";
    const r = kernel.kashiwa(mode);
    result.textContent = r.status;
    log.textContent += `\n${r.copy}\nnext=${r.job.kind}`;
    if (kernel.state.settings.sound) suzu();
    onJob(r.job);
    setTimeout(close, reduced ? 400 : 1400);
  }

  left.addEventListener("click", () => {
    struck.left = true;
    left.classList.add("struck");
    if (struck.right) compile();
  });
  right.addEventListener("click", () => {
    if (!struck.left) {
      log.textContent = "先に左手。二要素は順番がある。";
      return;
    }
    struck.right = true;
    right.classList.add("struck");
    compile();
  });

  stage.addEventListener("click", (e) => {
    if (e.target === stage) close();
  });

  return { open, close, suzu };
}
