export default {
  id: "ma",
  title: "間",
  width: "min(560px, 80vw)",
  height: "min(420px, 64vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let lastSig = "";
    const render = () => {
      const s = kernel.state.settings;
      const sig = `${s.silent}|${s.irqMs}|${s.sound}`;
      if (sig === lastSig && el.querySelector("#silent")) return;
      lastSig = sig;
      el.innerHTML = `
        <p class="lede">間は、埋めるな</p>
        <p class="muted">通知の既定は沈黙。IRQの間隔は季節の下位互換。アイドルは機能である。</p>
        <div class="card">
          <label><input type="checkbox" id="silent" ${s.silent ? "checked" : ""} /> 氏子課は沈黙（推奨）</label>
        </div>
        <div class="card" style="margin-top:10px">
          <label>割込の間（ms）
            <input class="search" id="irq" type="number" min="4000" value="${s.irqMs}" style="margin-top:8px" />
          </label>
        </div>
        <div class="card" style="margin-top:10px">
          <label><input type="checkbox" id="sound" ${s.sound ? "checked" : ""} /> 鈴を許す</label>
        </div>
      `;
      el.querySelector("#silent").onchange = (e) => kernel.sysctl("ma.silent", e.target.checked);
      el.querySelector("#sound").onchange = (e) => kernel.sysctl("sound", e.target.checked);
      el.querySelector("#irq").onchange = (e) => kernel.sysctl("irq.ms", e.target.value);
    };
    render();
    const on = () => render();
    kernel.addEventListener("settings", on);
    return {
      el,
      title: "ma.idle",
      onClose() {
        kernel.removeEventListener("settings", on);
      },
    };
  },
};
