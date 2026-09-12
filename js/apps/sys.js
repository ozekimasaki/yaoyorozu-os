export default {
  id: "sys",
  title: "機械",
  width: "min(640px, 82vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let lastSig = "";
    let disk = { files: 0, dirs: 0, bytes: 0 };
    let diskTok = 0;

    function fmtUp() {
      const sec = Math.max(0, Math.floor((Date.now() - (kernel.bootedAt || Date.now())) / 1000));
      if (sec < 60) return `${sec}秒`;
      const m = Math.floor(sec / 60);
      if (m < 60) return `${m}分 ${sec % 60}秒`;
      const h = Math.floor(m / 60);
      return `${h}時 ${m % 60}分`;
    }

    function setText(sel, text) {
      const node = el.querySelector(sel);
      if (node && node.textContent !== text) node.textContent = text;
    }

    function paintCards() {
      const s = kernel.state;
      const kami = s.processes.filter((p) => p.kind !== "app").length;
      const shrines = Object.values(s.quotas).reduce((a, n) => a + n, 0);
      setText("[data-k=uid] h3", s.ujiko);
      setText("[data-k=uid] .muted", `未ログアウト ${s.logoutDays} 日`);
      setText("[data-k=space] h3", kernel.spacePref().name);
      setText("[data-k=proc] h3", String(kami));
      setText("[data-k=shrine] h3", shrines.toLocaleString("ja-JP"));
      setText("[data-k=gep] h3", Math.floor(s.gep).toLocaleString("ja-JP"));
      setText("[data-k=gep] .muted", `無縁 ${s.muen.toFixed(1)}%`);
      setText("[data-k=auth] h3", s.authenticated ? "通電" : "EPERM");
      setText("[data-k=auth] .muted", s.officialStatus || "未柏手");
      setText("[data-k=up] h3", fmtUp());
      setText("[data-k=disk] h3", `${disk.files}札`);
      setText("[data-k=disk] .muted", `${disk.bytes}B · ${String.fromCharCode(0x5323)} ${disk.dirs}`);
    }

    async function refreshDisk() {
      const tok = (diskTok += 1);
      try {
        const u = await kernel.vfs.usage("/");
        if (tok !== diskTok) return;
        disk = u;
        setText("[data-k=disk] h3", `${disk.files}札`);
        setText("[data-k=disk] .muted", `${disk.bytes}B · ${String.fromCharCode(0x5323)} ${disk.dirs}`);
      } catch (err) {
        if (tok !== diskTok) return;
      }
    }

    const render = () => {
      const s = kernel.state;
      const kami = s.processes.filter((p) => p.kind !== "app").length;
      const sig = `${s.ujiko}|${s.authenticated}|${s.currentSpace}|${kami}|${Math.floor(s.gep)}|${s.muen.toFixed(1)}|${s.officialStatus || ""}`;
      if (el.querySelector(".grid-2")) {
        if (sig === lastSig) {
          setText("[data-k=up] h3", fmtUp());
          return;
        }
        lastSig = sig;
        paintCards();
        return;
      }
      lastSig = sig;
      el.innerHTML = `
        <p class="lede">このブラウザが、${String.fromCharCode(0x7b8d, 0x4f53)}である</p>
        <div class="grid-2">
          <div class="card" data-k="uid"><div class="tag">UID</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="space"><div class="tag">SPACE</div><h3></h3><p class="muted">47のうちの一つ。親ではない。</p></div>
          <div class="card" data-k="proc"><div class="tag">PROC</div><h3></h3><p class="muted">アドレス空間。800万は枠、実体は遅延。</p></div>
          <div class="card" data-k="shrine"><div class="tag">SHRINE</div><h3></h3><p class="muted">縁fs /mnt/*/shrines</p></div>
          <div class="card" data-k="gep"><div class="tag">GEP</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="auth"><div class="tag">AUTH</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="up"><div class="tag">POWER</div><h3></h3><p class="muted">通電からの間</p></div>
          <div class="card" data-k="disk"><div class="tag">DISK</div><h3></h3><p class="muted">縁fs の器</p></div>
        </div>
      `;
      paintCards();
      refreshDisk();
    };

    render();
    const on = () => render();
    const onTick = () => setText("[data-k=up] h3", fmtUp());
    const onVfs = () => refreshDisk();
    kernel.addEventListener("auth", on);
    kernel.addEventListener("space", on);
    kernel.addEventListener("tick", onTick);
    kernel.addEventListener("vfs", onVfs);
    return {
      el,
      title: "machine.info",
      onClose() {
        kernel.removeEventListener("auth", on);
        kernel.removeEventListener("space", on);
        kernel.removeEventListener("tick", onTick);
        kernel.removeEventListener("vfs", onVfs);
      },
    };
  },
};
