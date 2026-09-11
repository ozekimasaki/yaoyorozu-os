export default {
  id: "net",
  title: "縁",
  width: "min(820px, 88vw)",
  height: "min(540px, 72vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    const render = () => {
      el.innerHTML = `
        <p class="lede">縁は双方向である</p>
        <p class="muted">東京負荷 ${kernel.state.tokyo.toFixed(0)}% · 地方神 ${kernel.state.local.toFixed(0)}% · ソケット ${kernel.state.sockets.length}</p>
        <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start">
          <input class="search" id="ping-to" placeholder="ping 先（縁 / 県名）" style="margin:0;max-width:200px" />
          <button class="btn" type="button" id="do-ping">ping</button>
          <button class="btn" type="button" id="do-mig">migrate 東京</button>
        </div>
        <table class="os-table">
          <thead><tr><th>FROM</th><th>TO</th><th>TTL</th><th>STATE</th></tr></thead>
          <tbody>
            ${kernel.state.sockets
              .slice(0, 24)
              .map((s) => `<tr><td>${s.from}</td><td>${s.toName || s.to}</td><td>${s.ttl}</td><td>${s.state}</td></tr>`)
              .join("")}
          </tbody>
        </table>
      `;
      el.querySelector("#do-ping").onclick = () => {
        kernel.ping(el.querySelector("#ping-to").value.trim() || "縁");
      };
      el.querySelector("#do-mig").onclick = () => {
        try {
          const dest = kernel.migrateTokyo();
          kernel.emit("spotlight", dest.id);
          launch("map");
        } catch (err) {
          kernel.log(`migrate: ${err.message}`, "net");
          if (err.message === "EPERM") kernel.emit("need-auth");
        }
      };
    };
    render();
    const on = () => render();
    kernel.addEventListener("change", on);
    kernel.addEventListener("net", on);
    return {
      el,
      title: "en.sock",
      onClose() {
        kernel.removeEventListener("change", on);
        kernel.removeEventListener("net", on);
      },
    };
  },
};
