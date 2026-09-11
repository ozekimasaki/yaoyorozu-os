export default {
  id: "fw",
  title: "注連縄",
  width: "min(720px, 86vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    const render = () => {
      el.innerHTML = `
        <p class="lede">既定は deny</p>
        <p class="muted">子ども・死者・病・失敗・祈りは保護ネットワーク。外せない。足せるのは、公開してよい儀礼だけ。</p>
        <table class="os-table">
          <thead><tr><th>対象</th><th>ACTION</th><th>注</th><th></th></tr></thead>
          <tbody>
            ${kernel.state.fw
              .map(
                (r) => `<tr>
                  <td>${r.name}</td>
                  <td>${r.action}</td>
                  <td class="muted">${r.note || ""}</td>
                  <td>${
                    r.locked
                      ? "locked"
                      : `<button class="btn" data-toggle="${r.id}">反転</button>`
                  }</td>
                </tr>`
              )
              .join("")}
          </tbody>
        </table>
        <div class="boot-actions" style="margin-top:16px;justify-content:flex-start">
          <input class="search" id="fw-name" placeholder="公開してよい儀礼の名" style="margin:0;max-width:240px" />
          <button class="btn" type="button" id="fw-add">ルールを足す</button>
        </div>
      `;
      el.querySelectorAll("[data-toggle]").forEach((btn) => {
        btn.onclick = () => {
          try {
            kernel.toggleFw(btn.dataset.toggle);
          } catch (err) {
            kernel.log(`fw: ${err.message}`, "fw");
          }
        };
      });
      el.querySelector("#fw-add").onclick = () => {
        const name = el.querySelector("#fw-name").value.trim();
        if (!name) return;
        try {
          kernel.addFwRule(name);
        } catch (err) {
          kernel.log(`fw: ${err.message}`, "fw");
          if (err.message === "EPERM") kernel.emit("need-auth");
        }
      };
    };
    render();
    const on = () => render();
    kernel.addEventListener("change", on);
    return {
      el,
      title: "shimenawa.fw",
      onClose() {
        kernel.removeEventListener("change", on);
      },
    };
  },
};
