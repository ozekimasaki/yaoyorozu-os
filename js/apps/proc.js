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
    let bound = false;
    const pageSize = 24;

    const rowsOf = () => {
      const all = kernel.state.processes.filter((p) => p.kind !== "app");
      const filtered = all.filter((p) => !q || `${p.name}${p.role}${p.note}${p.status}`.includes(q));
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
      if (page >= pages) page = Math.max(0, pages - 1);
      const start = page * pageSize;
      return { total: filtered.length, pages, rows: filtered.slice(start, start + pageSize) };
    };

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="muted" id="proc-lede"></p>
        <input class="search" id="proc-q" type="search" placeholder="神を検索（会議、無縁、睡眠…）" />
        <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start">
          <input class="search" id="spawn-name" placeholder="新しい神の名" style="margin:0;max-width:200px" />
          <input class="search" id="spawn-role" placeholder="役割" style="margin:0;max-width:140px" />
          <button class="btn primary" type="button" id="spawn-btn">立てる</button>
        </div>
        <table class="proc-table">
          <thead><tr><th>PID</th><th>NAME</th><th>ROLE</th><th>STAT</th><th>CPU</th><th>EN</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="boot-actions" style="margin-top:12px;justify-content:flex-start">
          <button class="btn" type="button" id="prev">前</button>
          <button class="btn" type="button" id="next">次</button>
        </div>
      `;
      el.querySelector("#proc-q").addEventListener("input", (e) => {
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
      el.querySelector("tbody").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-act]");
        const tr = e.target.closest("tr[data-id]");
        if (!btn || !tr) return;
        const act = btn.dataset.act;
        try {
          switch (act) {
            case "attach":
              kernel.attachKami(tr.dataset.id);
              break;
            case "hold": {
              const k = kernel.state.processes.find((p) => p.id === tr.dataset.id);
              if (k && k.status === "seasonal") kernel.wakeKami(tr.dataset.id);
              else kernel.holdKami(tr.dataset.id);
              break;
            }
            case "harai":
              kernel.harai(tr.dataset.id);
              break;
            default: {
              const _never = act;
              void _never;
            }
          }
        } catch (err) {
          kernel.log(`${act}: ${err.message}`, "proc");
          if (err.message === "EPERM") kernel.emit("need-auth");
        }
      });
    }

    const render = () => {
      bindOnce();
      const { total, pages, rows } = rowsOf();
      const lede = `稼働中の神 ${total} 柱（ページ ${page + 1}/${pages}）。新しい神を立ててよい。殺してはならない。`;
      const ledeEl = el.querySelector("#proc-lede");
      if (ledeEl && ledeEl.textContent !== lede) ledeEl.textContent = lede;
      const prev = el.querySelector("#prev");
      const next = el.querySelector("#next");
      if (prev) prev.disabled = page <= 0;
      if (next) next.disabled = page >= pages - 1;
      const sig = `${q}|${page}|${total}|${rows.map((r) => `${r.id}:${r.status}:${r.name}:${r.attached ? 1 : 0}:${r.en || 0}`).join("|")}`;
      if (sig === lastSig && el.querySelector("tbody")) return;
      lastSig = sig;
      el.querySelector("tbody").innerHTML = rows
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
                    <button class="btn" data-act="hold">${k.status === "seasonal" ? "起こす" : "休ませる"}</button>
                    <button class="btn" data-act="harai">祓い</button>
                  </td>
                </tr>`;
        })
        .join("");
    };

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.key !== "PageUp" && e.key !== "PageDown") return;
      e.preventDefault();
      if (e.key === "PageUp") page = Math.max(0, page - 1);
      else page += 1;
      render();
    });

    render();
    const onChange = () => render();
    const onTick = () => {
      el.querySelectorAll("tr[data-id]").forEach((tr) => {
        const k = kernel.state.processes.find((p) => p.id === tr.dataset.id);
        if (!k) return;
        const span = tr.querySelector(".cpu-bar span");
        if (!span) return;
        const w = `${Math.max(0, Math.min(99, k.cpu | 0))}%`;
        if (span.style.width !== w) span.style.width = w;
      });
    };
    kernel.addEventListener("ps", onChange);
    kernel.addEventListener("tick", onTick);
    return {
      el,
      title: "kami.ps",
      onFocus() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("ps", onChange);
        kernel.removeEventListener("tick", onTick);
      },
    };
  },
};
