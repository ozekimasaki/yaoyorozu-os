export default {
  id: "sim",
  title: "1000日",
  width: "min(780px, 86vw)",
  height: "min(560px, 72vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let timer = null;

    const render = () => {
      const s = kernel.state;
      el.innerHTML = `
        <p class="lede">最初の1000日を、先に失敗する</p>
        <div class="sim-stats">
          <div class="stat"><div class="k">DAY</div><div class="v">${s.sim.day}</div></div>
          <div class="stat"><div class="k">GEP</div><div class="v">${Math.floor(s.gep).toLocaleString("ja-JP")}</div></div>
          <div class="stat"><div class="k">無縁</div><div class="v">${s.muen.toFixed(1)}%</div></div>
          <div class="stat"><div class="k">地方神</div><div class="v">${s.local.toFixed(0)}%</div></div>
        </div>
        <div class="boot-actions" style="margin:0 0 16px;justify-content:flex-start">
          <button class="btn primary" type="button" id="sim-play">通電</button>
          <button class="btn" type="button" id="sim-step">1日</button>
          <button class="btn" type="button" id="sim-reset">遷宮</button>
        </div>
        <div class="sim-log">${s.sim.logs.join("\n")}</div>
      `;
      el.querySelector("#sim-step").onclick = () => kernel.simStep();
      el.querySelector("#sim-play").onclick = () => {
        if (timer) return;
        s.sim.running = true;
        timer = setInterval(() => {
          if (!s.sim.running || s.sim.day >= 1000) {
            clearInterval(timer);
            timer = null;
            s.sim.running = false;
            return;
          }
          kernel.simStep();
        }, 80);
      };
      el.querySelector("#sim-reset").onclick = () => {
        s.sim.day = 0;
        s.sim.logs = [];
        s.sim.running = false;
        kernel.simLine("再起動。未完了は消えない。ログだけが清まる。");
        kernel.emit("sim");
        kernel.emit("change");
      };
    };
    render();
    const on = () => render();
    kernel.addEventListener("sim", on);
    return {
      el,
      title: "days.1000",
      onClose() {
        if (timer) clearInterval(timer);
        kernel.removeEventListener("sim", on);
      },
    };
  },
};
