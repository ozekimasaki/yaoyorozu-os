export default {
  id: "sys",
  title: "機械",
  width: "min(640px, 82vw)",
  height: "min(480px, 68vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    const render = () => {
      const s = kernel.state;
      const kami = s.processes.filter((p) => p.kind !== "app").length;
      const shrines = Object.values(s.quotas).reduce((a, n) => a + n, 0);
      el.innerHTML = `
        <p class="lede">このブラウザが、筐体である</p>
        <div class="grid-2">
          <div class="card"><div class="tag">UID</div><h3>${s.ujiko}</h3><p class="muted">未ログアウト ${s.logoutDays} 日</p></div>
          <div class="card"><div class="tag">SPACE</div><h3>${kernel.spacePref().name}</h3><p class="muted">47のうちの一つ。親ではない。</p></div>
          <div class="card"><div class="tag">PROC</div><h3>${kami}</h3><p class="muted">アドレス空間。800万は枠、実体は遅延。</p></div>
          <div class="card"><div class="tag">SHRINE</div><h3>${shrines.toLocaleString("ja-JP")}</h3><p class="muted">縁fs /mnt/*/shrines</p></div>
          <div class="card"><div class="tag">GEP</div><h3>${Math.floor(s.gep).toLocaleString("ja-JP")}</h3><p class="muted">無縁 ${s.muen.toFixed(1)}%</p></div>
          <div class="card"><div class="tag">AUTH</div><h3>${s.authenticated ? "通電" : "EPERM"}</h3><p class="muted">${s.officialStatus || "未柏手"}</p></div>
        </div>
      `;
    };
    render();
    const on = () => render();
    kernel.addEventListener("auth", on);
    kernel.addEventListener("space", on);
    return {
      el,
      title: "machine.info",
      onClose() {
        kernel.removeEventListener("auth", on);
        kernel.removeEventListener("space", on);
      },
    };
  },
};
