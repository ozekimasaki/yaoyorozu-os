export default {
  id: "dmesg",
  title: "dmesg",
  width: "min(720px, 84vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
    const el = document.createElement("div");
    el.innerHTML = `<p class="muted">氏子課はここを読む。通知の既定は沈黙。</p><div class="term-out"></div>`;
    const out = el.querySelector(".term-out");
    out.textContent = kernel.state.dmesg.join("\n") || "（まだ鐘は鳴っていない）";
    out.scrollTop = out.scrollHeight;
    const on = (ev) => {
      const line = ev.detail;
      if (!line) return;
      const cur = out.textContent;
      if (cur === line || cur.endsWith(`\n${line}`)) return;
      if (cur === "（まだ鐘は鳴っていない）") out.textContent = line;
      else out.textContent += `\n${line}`;
      if (out.textContent.length > 12000) out.textContent = out.textContent.slice(-10000);
      out.scrollTop = out.scrollHeight;
    };
    kernel.addEventListener("dmesg", on);
    return {
      el,
      title: "kern.log",
      onClose() {
        kernel.removeEventListener("dmesg", on);
      },
    };
  },
};
