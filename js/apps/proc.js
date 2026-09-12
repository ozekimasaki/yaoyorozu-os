export default {
  id: "proc",
  title: "神",
  width: "min(920px, 90vw)",
  height: "min(580px, 76vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let q = "";
    let page = 0;
    let lastSig = "";
    const pageSize = 24;

    const rowsOf = () => {
      const all = kernel.state.processes.filter((p) => p.kind !== "app");
      const filtered = all.filter((p) => !q || `${p.name}${p.role}${p.note}${p.status}`.includes(q));
      const start = page * pageSize;
      return { total: filtered.length, rows: filtered.slice(start, start + pageSize) };
    };

    const render = () => {
      const { total, rows } = rowsOf();
      const sig = `${q}|${page}|${total}|${rows.map((r) => `${r.id}:${r.status}:${r.name}`).join("|")}`;
      if (sig === lastSig && el.querySelector(".proc-table")) return;
      lastSig = sig;
      el.innerHTML = `
        <p class="muted">稼働中の神 ${total} 柱（ページ ${page + 1}）。新しい神を立ててよい。殺してはならない。</p>
        <input class="search" type="search" placeholder="神を検索（会議、無縁、睡眠…）" value="${q}" />
        <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start">
          <input class="search" id="spawn-name" placeholder="新しい神の名" style="margin:0;max-width:200px" />
          <input class="search" id="spawn-role" placeholder="役割" style="margin:0;max-width:140px" />
          <button class="btn primary" type="button" id="spawn-btn">立てる</button>
        </div>
        <table class="proc-table">
          <thead><tr><th>PID</th><th>NAME</th><th>ROLE</th><th>STAT</th><th>CPU</th><th>EN</th><th></th></tr></thead>
          <tbody>
            ${rows
              .map((k) => {
                const cpu = Math.max(0, Math.min(99, k.cpu | 0));
                return `<tr data-id="${k.id}">
                  <td>${k.pid || "—"}</td>
                  <td>${k.name}${k.attached ? " · 当直" : ""}</td>
                  <td>${k.role}</td>
                  <td class="status-${k.status}">${k.status}</td>
                  <td><div class="cpu-bar"><span style="width:${cpu}%"></span></div></td>
                  <td>${(k.en || 0).toLocaleString("ja-JP")}</td>
                  <td class="row-actions">
                    <button class="btn" data-act="attach">アタッチ</button>
                    <button class="btn" data-act="harai">祓い</button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn" type="button" id="prev">前</button>
          <button class="btn" type="button" id="next">次</button>
        </div>
      `;
      el.querySelector(".search").addEventListener("input", (e) => {
        q = e.target.value;
        page = 0;
        render();
      });
      el.querySelector("#spawn-btn").onclick = () => {
        try {
          kernel.spawnKami({
            name: el.querySelector("#spawn-name").value.trim(),
            role: el.querySelector("#spawn-role").value.trim(),
          });
        } catch (err) {
          kernel.log(`spawn: ${err.message}`, "proc");
          kernel.emit("need-auth");
        }
      };
      el.querySelector("#prev").onclick = () => {
        page = Math.max(0, page - 1);
        render();
      };
      el.querySelector("#next").onclick = () => {
        page += 1;
        render();
      };
      el.querySelectorAll("tr[data-id]").forEach((tr) => {
        tr.querySelector("[data-act=attach]").onclick = () => {
          try {
            kernel.attachKami(tr.dataset.id);
          } catch (err) {
            kernel.log(`attach: ${err.message}`, "proc");
            if (err.message === "EPERM") kernel.emit("need-auth");
          }
        };
        tr.querySelector("[data-act=harai]").onclick = () => {
          try {
            kernel.harai(tr.dataset.id);
          } catch (err) {
            kernel.log(`harai: ${err.message}`, "proc");
          }
        };
      });
    };

    render();
    const onChange = () => render();
    const onTick = () => {
      el.querySelectorAll("tr[data-id]").forEach((tr) => {
        const k = kernel.state.processes.find((p) => p.id === tr.dataset.id);
        if (!k) return;
        const span = tr.querySelector(".cpu-bar span");
        if (span) span.style.width = `${Math.max(0, Math.min(99, k.cpu | 0))}%`;
      });
    };
    kernel.addEventListener("ps", onChange);
    kernel.addEventListener("tick", onTick);
    return {
      el,
      title: "kami.ps",
      onClose() {
        kernel.removeEventListener("ps", onChange);
        kernel.removeEventListener("tick", onTick);
      },
    };
  },
};
