export default {
  id: "sys",
  title: "機械",
  width: "min(640px, 82vw)",
  height: "min(640px, 78vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    el.className = "sys-app";
    let lastSig = "";
    let disk = { files: 0, dirs: 0, bytes: 0 };
    let diskTok = 0;

    function fmtUp() {
      const sec = Math.max(0, Math.floor((Date.now() - (kernel.bootedAt || Date.now())) / 1000));
      if (sec < 60) return `${sec}秒`;
      const m = Math.floor(sec / 60);
      if (m < 60) return `${m}分 ${sec % 60}秒`;
      const h = Math.floor(m / 60);
      return `${h}時 ${m % 60}分`;
    }

    function setText(sel, text) {
      const node = el.querySelector(sel);
      if (node && node.textContent !== text) node.textContent = text;
    }

    function keshikiSnap() {
      return kernel.keshiki && kernel.keshiki.snapshot ? kernel.keshiki.snapshot() : { path: "", scale: 1, has: false };
    }

    function utsushiSnap() {
      return kernel.utsushi && kernel.utsushi.snapshot ? kernel.utsushi.snapshot() : { count: 0, last: "" };
    }

    function utsuwaSnap() {
      return kernel.utsuwa && kernel.utsuwa.snapshot ? kernel.utsuwa.snapshot() : { bytes: 0, quota: 0, files: 0, over: false };
    }

    function okoshiSnap() {
      return kernel.okoshi && kernel.okoshi.snapshot ? kernel.okoshi.snapshot() : { ids: [] };
    }

    function paintBoard() {
      const s = kernel.state.settings || {};
      const k = keshikiSnap();
      const u = utsushiSnap();
      const w = utsuwaSnap();
      const o = okoshiSnap();
      const fmt = kernel.utsuwa && kernel.utsuwa.fmtBytes ? kernel.utsuwa.fmtBytes : (n) => `${n}B`;
      setText("[data-k=keshiki] h3", k.path ? k.path.split("/").pop() : "未敷");
      setText("[data-k=keshiki] .muted", k.path || "写しを卓の背に敷く");
      setText("[data-k=scale] h3", `×${k.scale || s.scale || 1}`);
      setText("[data-k=shot] h3", `${u.count || 0}枚`);
      setText("[data-k=shot] .muted", u.last || "まだ映していない");
      setText("[data-k=utsuwa] h3", `${fmt(w.bytes)}/${fmt(w.quota)}`);
      setText("[data-k=utsuwa] .muted", w.over ? "満杯。掃くと縁が戻る" : `${w.files || 0}札`);
      const bar = el.querySelector("#sys-utsuwa-bar");
      if (bar) bar.style.width = `${Math.min(100, w.quota ? (100 * (w.bytes || 0)) / w.quota : 0)}%`;
      setText("[data-k=okoshi] h3", o.ids && o.ids.length ? o.ids.join(" · ") : "空");
      setText("[data-k=okoshi] .muted", "卓が点いたとき立つ札。窓の復元が先。");
      el.querySelectorAll("[data-okoshi]").forEach((b) => {
        b.classList.toggle("is-on", !!(o.ids && o.ids.includes(b.dataset.okoshi)));
      });
      el.querySelectorAll("[data-scale]").forEach((b) => {
        b.classList.toggle("is-on", Number(b.dataset.scale) === Number(k.scale || s.scale || 1));
      });
      const silent = el.querySelector("#sys-silent");
      const sound = el.querySelector("#sys-sound");
      if (silent) silent.checked = !!s.silent;
      if (sound) sound.checked = !!s.sound;
    }

    function paintCards() {
      const s = kernel.state;
      const kami = s.processes.filter((p) => p.kind !== "app").length;
      const shrines = Object.values(s.quotas).reduce((a, n) => a + n, 0);
      setText("[data-k=uid] h3", s.ujiko);
      setText("[data-k=uid] .muted", `未ログアウト ${s.logoutDays} 日`);
      setText("[data-k=space] h3", kernel.spacePref().name);
      setText("[data-k=proc] h3", String(kami));
      setText("[data-k=shrine] h3", shrines.toLocaleString("ja-JP"));
      setText("[data-k=gep] h3", Math.floor(s.gep).toLocaleString("ja-JP"));
      setText("[data-k=gep] .muted", `無縁 ${s.muen.toFixed(1)}%`);
      setText("[data-k=auth] h3", s.authenticated ? "通電" : "EPERM");
      setText("[data-k=auth] .muted", s.officialStatus || "未柏手");
      setText("[data-k=up] h3", fmtUp());
      const w = utsuwaSnap();
      const fmt = kernel.utsuwa && kernel.utsuwa.fmtBytes ? kernel.utsuwa.fmtBytes : (n) => `${n}B`;
      setText("[data-k=disk] h3", `${disk.files}札`);
      setText("[data-k=disk] .muted", w.quota ? `${fmt(disk.bytes)}/${fmt(w.quota)}` : `${disk.bytes}B · ${String.fromCharCode(0x5323)} ${disk.dirs}`);
      paintBoard();
    }

    async function refreshDisk() {
      const tok = (diskTok += 1);
      try {
        const u = await kernel.vfs.usage("/");
        if (tok !== diskTok) return;
        disk = u;
        setText("[data-k=disk] h3", `${disk.files}札`);
        setText("[data-k=disk] .muted", `${disk.bytes}B · ${String.fromCharCode(0x5323)} ${disk.dirs}`);
      } catch (err) {
        if (tok !== diskTok) return;
      }
    }

    function bindBoard() {
      const lay = el.querySelector("#sys-keshiki-last");
      const wipe = el.querySelector("#sys-keshiki-clear");
      const glass = el.querySelector("#sys-keshiki-kagami");
      const shot = el.querySelector("#sys-utsushi");
      if (lay) {
        lay.onclick = () => {
          if (!kernel.keshiki || !kernel.keshiki.fromLast) return;
          kernel.keshiki.fromLast().catch((err) => kernel.log(`keshiki: ${err.message}`, "keshiki"));
        };
      }
      if (wipe) {
        wipe.onclick = () => {
          if (!kernel.keshiki || !kernel.keshiki.clear) return;
          kernel.keshiki.clear().catch((err) => kernel.log(`keshiki: ${err.message}`, "keshiki"));
        };
      }
      if (glass) {
        glass.onclick = () => {
          if (launch) launch("kagami");
        };
      }
      if (shot) {
        shot.onclick = () => {
          if (kernel.utsushi && kernel.utsushi.snap) {
            kernel.utsushi.snap({ reason: "sys" }).catch((err) => kernel.log(`utsushi: ${err.message}`, "utsushi"));
          }
        };
      }
      el.querySelectorAll("[data-scale]").forEach((b) => {
        b.onclick = () => kernel.sysctl("ui.scale", b.dataset.scale);
      });
      const silent = el.querySelector("#sys-silent");
      const sound = el.querySelector("#sys-sound");
      if (silent) silent.onchange = (e) => kernel.sysctl("ma.silent", e.target.checked);
      if (sound) sound.onchange = (e) => kernel.sysctl("sound", e.target.checked);
      const sweep = el.querySelector("#sys-utsuwa-sweep");
      if (sweep) {
        sweep.onclick = () => {
          if (kernel.utsuwa && kernel.utsuwa.sweep) {
            kernel.utsuwa.sweep({ hard: true }).catch((err) => kernel.log(`utsuwa: ${err.message}`, "utsuwa"));
          }
        };
      }
      el.querySelectorAll("[data-okoshi]").forEach((b) => {
        b.onclick = () => {
          if (!kernel.okoshi) return;
          const id = b.dataset.okoshi;
          const have = kernel.okoshi.list().includes(id);
          const op = have ? kernel.okoshi.rm(id) : kernel.okoshi.add(id);
          op.catch((err) => kernel.log(`okoshi: ${err.message}`, "okoshi"));
        };
      });
    }

    const render = () => {
      const s = kernel.state;
      const kami = s.processes.filter((p) => p.kind !== "app").length;
      const k = keshikiSnap();
      const u = utsushiSnap();
      const w = utsuwaSnap();
      const o = okoshiSnap();
      const set = s.settings || {};
      const sig = `${s.ujiko}|${s.authenticated}|${s.currentSpace}|${kami}|${Math.floor(s.gep)}|${s.muen.toFixed(1)}|${s.officialStatus || ""}|${k.path}|${k.scale}|${u.count}|${set.silent}|${set.sound}|${w.bytes}|${w.quota}|${(o.ids || []).join(",")}`;
      if (el.querySelector(".grid-2")) {
        if (sig === lastSig) {
          setText("[data-k=up] h3", fmtUp());
          return;
        }
        lastSig = sig;
        paintCards();
        return;
      }
      lastSig = sig;
      el.innerHTML = `
        <p class="lede">このブラウザが、${String.fromCharCode(0x7b50, 0x4f53)}である</p>
        <div class="grid-2">
          <div class="card" data-k="uid"><div class="tag">UID</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="space"><div class="tag">SPACE</div><h3></h3><p class="muted">47のうちの一つ。親ではない。</p></div>
          <div class="card" data-k="proc"><div class="tag">PROC</div><h3></h3><p class="muted">アドレス空間。800万は枠、実体は遅延。</p></div>
          <div class="card" data-k="shrine"><div class="tag">SHRINE</div><h3></h3><p class="muted">縁fs /mnt/*/shrines</p></div>
          <div class="card" data-k="gep"><div class="tag">GEP</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="auth"><div class="tag">AUTH</div><h3></h3><p class="muted"></p></div>
          <div class="card" data-k="up"><div class="tag">POWER</div><h3></h3><p class="muted">通電からの間</p></div>
          <div class="card" data-k="disk"><div class="tag">DISK</div><h3></h3><p class="muted">縁fs の器</p></div>
        </div>
        <div class="sys-board">
          <div class="card" data-k="keshiki">
            <div class="tag">KESHIKI</div>
            <h3></h3>
            <p class="muted"></p>
            <div class="boot-actions">
              <button class="btn primary" type="button" id="sys-keshiki-last">写しを敷く</button>
              <button class="btn" type="button" id="sys-keshiki-clear">払う</button>
              <button class="btn" type="button" id="sys-keshiki-kagami">鏡</button>
            </div>
          </div>
          <div class="card" data-k="scale">
            <div class="tag">SCALE</div>
            <h3></h3>
            <p class="muted">文字の大きさ。卓の間を変える。</p>
            <div class="boot-actions">
              <button class="btn" type="button" data-scale="0.9">小</button>
              <button class="btn" type="button" data-scale="1">正</button>
              <button class="btn" type="button" data-scale="1.15">大</button>
            </div>
          </div>
          <div class="card" data-k="shot">
            <div class="tag">UTSUSHI</div>
            <h3></h3>
            <p class="muted"></p>
            <div class="boot-actions">
              <button class="btn" type="button" id="sys-utsushi">映す</button>
            </div>
          </div>
          <div class="card" data-k="ma">
            <div class="tag">MA</div>
            <label><input type="checkbox" id="sys-silent" /> 沈黙</label>
            <label><input type="checkbox" id="sys-sound" /> 鈴</label>
          </div>
          <div class="card" data-k="utsuwa">
            <div class="tag">UTSUWA</div>
            <h3></h3>
            <p class="muted"></p>
            <div class="utsuwa-track"><span id="sys-utsuwa-bar"></span></div>
            <div class="boot-actions">
              <button class="btn" type="button" id="sys-utsuwa-sweep">掃く</button>
            </div>
          </div>
          <div class="card" data-k="okoshi">
            <div class="tag">OKOSHI</div>
            <h3></h3>
            <p class="muted"></p>
            <div class="boot-actions">
              <button class="btn" type="button" data-okoshi="oncall">当直</button>
              <button class="btn" type="button" data-okoshi="sys">機械</button>
              <button class="btn" type="button" data-okoshi="term">奉納</button>
              <button class="btn" type="button" data-okoshi="fs">縁fs</button>
            </div>
          </div>
        </div>
      `;
      bindBoard();
      paintCards();
      refreshDisk();
    };

    render();
    const on = () => render();
    const onTick = () => setText("[data-k=up] h3", fmtUp());
    const onVfs = () => refreshDisk();
    kernel.addEventListener("auth", on);
    kernel.addEventListener("space", on);
    kernel.addEventListener("tick", onTick);
    kernel.addEventListener("vfs", onVfs);
    kernel.addEventListener("keshiki", on);
    kernel.addEventListener("settings", on);
    kernel.addEventListener("utsushi", on);
    kernel.addEventListener("utsuwa", on);
    kernel.addEventListener("okoshi", on);
    return {
      el,
      title: "machine.info",
      onClose() {
        kernel.removeEventListener("auth", on);
        kernel.removeEventListener("space", on);
        kernel.removeEventListener("tick", onTick);
        kernel.removeEventListener("vfs", onVfs);
        kernel.removeEventListener("keshiki", on);
        kernel.removeEventListener("settings", on);
        kernel.removeEventListener("utsushi", on);
        kernel.removeEventListener("utsuwa", on);
        kernel.removeEventListener("okoshi", on);
      },
    };
  },
};
