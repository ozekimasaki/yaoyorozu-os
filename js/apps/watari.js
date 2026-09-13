import { openPath } from "../runtime.js";

export default {
  id: "watari",
  title: "\u6e21\u308a",
  width: "min(720px, 90vw)",
  height: "min(620px, 78vh)",
  spawn({ kernel, path: startPath, offer }) {
    const el = document.createElement("div");
    el.className = "watari-app";
    let via = "shrine";
    let lastSig = "";
    let err = "";

    function kotobaEl() {
      return el.querySelector("#watari-kotoba");
    }

    function fudaEl() {
      return el.querySelector("#watari-fuda");
    }

    function sendEl() {
      return el.querySelector("#watari-send");
    }

    function snap() {
      return kernel.watari ? kernel.watari.snapshot() : { status: "still" };
    }

    function paint() {
      const s = snap();
      const sig = `${s.status}|${s.via}|${s.kotoba}|${s.peer}|${s.sent}|${s.recv}|${s.lastErr}|${err}|${via}`;
      const body = el.querySelector(".watari-body");
      if (sig === lastSig && body) return;
      lastSig = sig;
      el.dataset.state = s.status || "still";
      if (!body) {
        el.innerHTML = `
          <div class="watari-body">
            <p class="lede">\u7e01\u306f\u53cc\u65b9\u5411\u3067\u3042\u308b\u3002\u6e21\u308a\u306f\u6c0f\u5b50\u3068\u6c0f\u5b50\u306e\u821f\u3002</p>
            <p class="muted" id="watari-stat"></p>
            <p class="muted" id="watari-err"></p>
            <div class="boot-actions" style="margin:0 0 10px;justify-content:flex-start;flex-wrap:wrap">
              <button class="btn" type="button" data-via="shrine" id="watari-via-shrine">\u793e</button>
              <button class="btn" type="button" data-via="kotoba" id="watari-via-kotoba">\u9060\u7e01</button>
              <button class="btn" type="button" data-via="ofuda" id="watari-via-ofuda">\u672d</button>
            </div>
            <input class="search" id="watari-kotoba" placeholder="\u5408\u8a00\u8449" aria-label="\u5408\u8a00\u8449" style="margin:0 0 10px;max-width:100%" />
            <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start;flex-wrap:wrap">
              <button class="btn primary" type="button" id="watari-invite">\u62db\u304f</button>
              <button class="btn" type="button" id="watari-join">\u6e21\u308b</button>
              <button class="btn" type="button" id="watari-close">\u89e3\u304f</button>
            </div>
            <textarea id="watari-fuda" class="search" rows="6" placeholder="\u62db\u304d\u672d / \u8fd4\u3057\u672d" aria-label="\u6e21\u308a\u306e\u672d" style="width:100%;min-height:120px;margin:0 0 8px"></textarea>
            <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start;flex-wrap:wrap">
              <button class="btn" type="button" id="watari-copy">\u672d\u3092\u5199\u3059</button>
              <button class="btn" type="button" id="watari-reply">\u672d\u3092\u8fd4\u3059</button>
              <button class="btn" type="button" id="watari-take">\u672d\u3092\u53d7\u3051\u308b</button>
            </div>
            <input class="search" id="watari-send" placeholder="\u9053 / \u8a00\u970a" aria-label="\u9001\u308b\u672d" style="margin:0 0 8px;max-width:100%" />
            <div class="boot-actions" style="margin:0 0 12px;justify-content:flex-start;flex-wrap:wrap">
              <button class="btn primary" type="button" id="watari-post">\u9001\u308b</button>
              <button class="btn" type="button" id="watari-inbox">\u53d7\u3051\u305f\u5323</button>
            </div>
            <ul class="watari-log" id="watari-log"></ul>
          </div>
        `;
        bind();
      }
      const stat = el.querySelector("#watari-stat");
      if (stat) {
        stat.textContent = `state=${s.status || "still"} \u00b7 via=${s.via || via} \u00b7 ${s.kotoba || ""} \u00b7 peer=${s.peer || "-"} \u00b7 ${s.sent || 0}\u9001 ${s.recv || 0}\u53d7`;
      }
      const errEl = el.querySelector("#watari-err");
      if (errEl) errEl.textContent = err || s.lastErr || "";
      el.querySelectorAll("[data-via]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.via === via);
      });
      const box = kotobaEl();
      if (box && !box.value && s.kotoba) box.value = s.kotoba;
      const fuda = fudaEl();
      if (fuda && !fuda.value) {
        if (s.offer) fuda.value = s.offer;
        else if (s.answer) fuda.value = s.answer;
      }
    }

    function kotoba() {
      return (kotobaEl() && kotobaEl().value.trim()) || "";
    }

    async function run(fn) {
      err = "";
      try {
        await fn();
      } catch (e) {
        err = e.message || String(e);
        kernel.log(`watari: ${err}`, "watari");
      }
      lastSig = "";
      paint();
    }

    function bind() {
      el.querySelectorAll("[data-via]").forEach((b) => {
        b.onclick = () => {
          via = b.dataset.via;
          lastSig = "";
          paint();
        };
      });
      el.querySelector("#watari-invite").onclick = () =>
        run(async () => {
          await kernel.watari.open({ via, kotoba: kotoba() });
          const fuda = fudaEl();
          if (fuda && kernel.watari.offerText()) fuda.value = kernel.watari.offerText();
        });
      el.querySelector("#watari-join").onclick = () =>
        run(() => kernel.watari.join({ via, kotoba: kotoba() }));
      el.querySelector("#watari-close").onclick = () => run(() => kernel.watari.close());
      el.querySelector("#watari-copy").onclick = () => {
        const sdp = kernel.watari.offerText() || kernel.watari.answerText() || (fudaEl() && fudaEl().value) || "";
        if (fudaEl()) fudaEl().value = sdp;
        if (sdp && kernel.clipPush) kernel.clipPush(sdp);
      };
      el.querySelector("#watari-reply").onclick = () =>
        run(async () => {
          const sdp = (fudaEl() && fudaEl().value) || "";
          const answer = await kernel.watari.acceptOffer(sdp);
          if (fudaEl()) fudaEl().value = answer || "";
        });
      el.querySelector("#watari-take").onclick = () =>
        run(async () => {
          const sdp = (fudaEl() && fudaEl().value) || "";
          await kernel.watari.acceptAnswer(sdp);
        });
      el.querySelector("#watari-post").onclick = () =>
        run(async () => {
          const raw = (sendEl() && sendEl().value.trim()) || startPath || "";
          if (!raw) throw new Error("EINVAL");
          if (raw.startsWith("/") || raw.includes(".")) await kernel.watari.sendPath(kernel.vfs.normalize(raw));
          else await kernel.watari.sendText(raw);
        });
      el.querySelector("#watari-inbox").onclick = () => openPath("/var/watari");
    }

    async function fillLog() {
      const host = el.querySelector("#watari-log");
      if (!host) return;
      try {
        const kids = await kernel.listPath("/var/watari");
        host.innerHTML = kids
          .filter((f) => f.type !== "dir")
          .slice(0, 12)
          .map((f) => `<li><button type="button" data-open="${f.path}">${f.name}</button></li>`)
          .join("") || `<li class="muted">\u307e\u3060\u7a7a\u306e\u5323</li>`;
        host.querySelectorAll("[data-open]").forEach((b) => {
          b.onclick = () => openPath(b.dataset.open);
        });
      } catch (e) {
        host.textContent = e.message;
      }
    }

    paint();
    fillLog();
    if (startPath && sendEl()) sendEl().value = startPath;
    if (offer && offer.path && sendEl()) sendEl().value = offer.path;
    const on = () => {
      lastSig = "";
      paint();
      fillLog();
    };
    kernel.addEventListener("watari", on);
    kernel.addEventListener("watari-recv", on);
    kernel.addEventListener("vfs", on);
    return {
      el,
      title: "watari",
      onOffer(next) {
        if (next && next.path && sendEl()) sendEl().value = next.path;
      },
      onDrop(paths) {
        const p = paths && paths[0];
        if (p && sendEl()) sendEl().value = p;
      },
      onClose() {
        kernel.removeEventListener("watari", on);
        kernel.removeEventListener("watari-recv", on);
        kernel.removeEventListener("vfs", on);
      },
    };
  },
};
