export default {
  id: "fw",
  title: "注連縄",
  width: "min(720px, 86vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    let lastSig = "";
    let bound = false;
    let pick = "";

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">既定は deny</p>
        <p class="muted">子ども・死者・病・失敗・祈りは保護ネットワーク。外せない。足せるのは、公開してよい儀礼だけ。</p>
        <table class="os-table">
          <thead><tr><th>対象</th><th>ACTION</th><th>注</th><th></th></tr></thead>
          <tbody></tbody>
        </table>
        <div class="boot-actions" style="margin-top:16px;justify-content:flex-start">
          <input class="search" id="fw-name" placeholder="公開してよい儀礼の名" style="margin:0;max-width:240px" />
          <button class="btn" type="button" id="fw-add">ルールを足す</button>
        </div>
      `;
      el.querySelector("tbody").addEventListener("click", (e) => {
        const tr = e.target.closest("tr[data-id]");
        if (tr) pick = tr.dataset.id;
        paintPick();
        const btn = e.target.closest("[data-toggle]");
        if (!btn) return;
        try {
          kernel.toggleFw(btn.dataset.toggle);
        } catch (err) {
          kernel.log(`fw: ${err.message}`, "fw");
        }
      });
      const add = () => {
        const box = el.querySelector("#fw-name");
        const name = (box && box.value.trim()) || "";
        if (!name) return;
        try {
          kernel.addFwRule(name);
          if (box) box.value = "";
        } catch (err) {
          kernel.log(`fw: ${err.message}`, "fw");
          if (err.message === "EPERM") kernel.emit("need-auth");
        }
      };
      el.querySelector("#fw-add").onclick = add;
      el.querySelector("#fw-name").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      });
    }

    function paintPick() {
      el.querySelectorAll("tbody tr[data-id]").forEach((tr) => {
        tr.classList.toggle("is-on", tr.dataset.id === pick);
      });
    }

    function movePick(dir) {
      const rows = [...el.querySelectorAll("tbody tr[data-id]")];
      if (!rows.length) return;
      let i = rows.findIndex((tr) => tr.dataset.id === pick);
      if (i < 0) i = dir > 0 ? -1 : 0;
      i = Math.max(0, Math.min(rows.length - 1, i + dir));
      pick = rows[i].dataset.id;
      paintPick();
      rows[i].scrollIntoView({ block: "nearest" });
    }

    function jumpName(ch) {
      const needle = ch.toLowerCase();
      const rows = [...el.querySelectorAll("tbody tr[data-id]")];
      if (!rows.length) return;
      const cur = Math.max(0, rows.findIndex((tr) => tr.dataset.id === pick));
      for (let i = 1; i <= rows.length; i += 1) {
        const j = (cur + i) % rows.length;
        const name = (rows[j].dataset.name || "").toLowerCase();
        if (name.startsWith(needle)) {
          pick = rows[j].dataset.id;
          paintPick();
          rows[j].scrollIntoView({ block: "nearest" });
          return;
        }
      }
    }

    function togglePick() {
      if (!pick) return;
      const rule = (kernel.state.fw || []).find((r) => r.id === pick);
      if (!rule) return;
      if (rule.locked) {
        kernel.log("fw: EPERM", "fw");
        return;
      }
      try {
        kernel.toggleFw(pick);
      } catch (err) {
        kernel.log(`fw: ${err.message}`, "fw");
      }
    }

    const render = () => {
      bindOnce();
      const rows = kernel.state.fw || [];
      const sig = rows.map((r) => `${r.id}:${r.action}:${r.name}`).join("|");
      if (sig !== lastSig || !el.querySelector("tbody tr")) {
        lastSig = sig;
        el.querySelector("tbody").innerHTML = rows
          .map(
            (r) => `<tr data-id="${r.id}" data-name="${r.name}">
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
          .join("");
        if (pick && !rows.some((r) => r.id === pick)) pick = "";
      }
      paintPick();
    };

    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.target && e.target.tagName === "INPUT") return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        movePick(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        movePick(-1);
      } else if (e.key === "Home") {
        e.preventDefault();
        const first = el.querySelector("tbody tr[data-id]");
        if (first) {
          pick = first.dataset.id;
          paintPick();
        }
      } else if (e.key === "End") {
        e.preventDefault();
        const rows = el.querySelectorAll("tbody tr[data-id]");
        const last = rows[rows.length - 1];
        if (last) {
          pick = last.dataset.id;
          paintPick();
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        togglePick();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing) {
        e.preventDefault();
        e.stopPropagation();
        jumpName(e.key);
      }
    });

    render();
    const on = () => render();
    kernel.addEventListener("fw", on);
    return {
      el,
      title: "shimenawa.fw",
      onFocus() {
        if (document.activeElement && document.activeElement.tagName === "INPUT") return;
        el.focus();
      },
      onClose() {
        kernel.removeEventListener("fw", on);
      },
    };
  },
};
