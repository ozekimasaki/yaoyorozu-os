import { createEngine, liveScore, looksMedia, looksVideo, mediaUrl, parseScore } from "../oto-synth.js";
import { attachOto } from "../oto-kern.js";

function seatId(path, title) {
  return path || `live:${title}`;
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const s = Math.max(0, sec | 0);
  const m = (s / 60) | 0;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function safeName(name) {
  return String(name || "media")
    .replace(/[\\/]/g, "_")
    .slice(0, 80);
}

function readFileAsData(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("read"));
    fr.readAsDataURL(file);
  });
}

export default {
  id: "oto",
  title: "\u97f3\u970a",
  width: "min(640px, 86vw)",
  height: "min(580px, 76vh)",
  spawn({ kernel, wm, pid, path: startPath, offer }) {
    attachOto(kernel);
    const el = document.createElement("div");
    el.className = "oto-app";
    const engine = createEngine();
    const media = document.createElement("audio");
    const video = document.createElement("video");
    media.preload = "metadata";
    video.preload = "metadata";
    video.playsInline = true;
    video.controls = false;
    let seats = [];
    let pick = 0;
    let mode = "score";
    let bound = false;
    let raf = 0;
    let pulse = 0;

    function mediaNode() {
      return video.getAttribute("src") ? video : media;
    }

    function nowText() {
      const st = engine.status();
      const seat = seats[pick];
      if (!seat) return "\u5ea7\u3092\u62db\u3051\u3002";
      if (mode === "media") {
        const n = mediaNode();
        const clock = `${fmtTime(n.currentTime)} / ${fmtTime(n.duration)}`;
        if (!n.paused && !n.ended) return `\u9cf4\u308b  ${seat.title}  ${clock}`;
        if (n.paused && n.currentTime > 0) return `\u9593  ${seat.title}  ${clock}`;
        return `\u5ea7  ${seat.title}`;
      }
      if (st.playing && st.paused) return `\u9593  ${seat.title}`;
      if (st.playing) return `\u9cf4\u308b  ${seat.title}`;
      return `\u5ea7  ${seat.title}`;
    }

    function mediaProgress() {
      const n = mediaNode();
      if (!n.duration || !Number.isFinite(n.duration) || n.duration <= 0) return 0;
      return Math.max(0, Math.min(1, n.currentTime / n.duration));
    }

    function paintMeter() {
      const fill = el.querySelector("#oto-meter-fill");
      if (!fill) return;
      if (mode === "media") {
        fill.style.transform = `scaleX(${mediaProgress()})`;
        return;
      }
      const st = engine.status();
      const live = st.playing && !st.paused;
      const steps = (seats[pick] && seats[pick].score && seats[pick].score.steps) || [];
      const t = live && steps.length ? ((st.step % steps.length) + pulse) / steps.length : live ? Math.min(1, 0.35 + pulse) : 0.08;
      fill.style.transform = `scaleX(${Math.max(0.04, Math.min(1, t))})`;
    }

    function drawField() {
      const canvas = el.querySelector("#oto-field");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "rgba(12,11,9,0.22)";
      ctx.fillRect(0, 0, w, h);
      const st = engine.status();
      const live =
        (mode === "score" && st.playing && !st.paused) || (mode === "media" && !mediaNode().paused && !mediaNode().ended);
      const rings = live ? 5 : 2;
      const cx = w / 2;
      const cy = h / 2;
      for (let i = 0; i < rings; i += 1) {
        const r = 18 + i * 22 + (live ? pulse * 26 : 0);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 ? "rgba(201,162,39,0.28)" : "rgba(194,58,43,0.22)";
        ctx.lineWidth = live ? 1.6 : 1;
        ctx.stroke();
      }
    }

    function tickViz() {
      const st = engine.status();
      const live =
        (mode === "score" && st.playing && !st.paused) || (mode === "media" && !mediaNode().paused && !mediaNode().ended);
      if (live) pulse = Math.max(0, pulse * 0.92);
      else pulse *= 0.8;
      drawField();
      paintMeter();
      const now = el.querySelector("#oto-now");
      if (now && mode === "media") now.textContent = nowText();
      raf = window.requestAnimationFrame(tickViz);
    }

    function ownsNow() {
      const now = kernel.state.oto || {};
      return !now.pid || now.pid === pid || now.state === "still";
    }

    function publish() {
      if (!ownsNow()) return;
      const st = el.dataset.state || "still";
      const seat = seats[pick];
      kernel.noteOto({
        title: seat ? seat.title : "",
        path: (seat && seat.path) || "",
        state: st,
        pid: st === "still" ? 0 : pid,
        kind: (seat && seat.kind) || "",
      });
    }

    function setState() {
      const st = engine.status();
      const node = mediaNode();
      const mediaLive = mode === "media" && !node.paused && !node.ended;
      const playing = mode === "media" ? mediaLive : st.playing && !st.paused;
      const ma = mode === "media" ? node.paused && node.currentTime > 0 && !node.ended : st.playing && st.paused;
      el.dataset.state = ma ? "ma" : playing ? "live" : "still";
      const now = el.querySelector("#oto-now");
      if (now) now.textContent = nowText();
      const invite = el.querySelector("#oto-invite");
      const maBtn = el.querySelector("#oto-ma");
      const loopBtn = el.querySelector("#oto-loop");
      if (invite) invite.classList.toggle("is-on", playing);
      if (maBtn) maBtn.classList.toggle("is-on", ma);
      if (loopBtn) loopBtn.classList.toggle("is-on", st.loop);
      const seat = seats[pick];
      if (wm && wm.setTitle && pid) wm.setTitle(pid, seat ? seat.title : "\u97f3\u970a");
      el.querySelectorAll("[data-seat]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.seat === (seat && seat.id));
      });
      publish();
    }

    function stopMedia() {
      media.pause();
      video.pause();
      try {
        media.removeAttribute("src");
        video.removeAttribute("src");
        media.load();
        video.load();
      } catch (err) {
        /* empty */
      }
      const stage = el.querySelector(".oto-stage");
      if (stage) stage.hidden = true;
    }

    async function invite() {
      const seat = seats[pick];
      if (!seat) return;
      if (seat.kind === "media") {
        mode = "media";
        engine.stop();
        const node = looksVideo(seat.path, seat.file) ? video : media;
        const url = mediaUrl(seat.file);
        if (!url) return;
        stopMedia();
        node.loop = engine.status().loop;
        node.src = url;
        try {
          await node.play();
        } catch (err) {
          kernel.log(`oto: ${err.message}`, "oto");
        }
      } else {
        mode = "score";
        stopMedia();
        await engine.play(seat.score);
      }
      kernel.noteJournal("oto", seat.title, { path: seat.path || "", pid });
      setState();
    }

    async function enterMa() {
      if (mode === "media") {
        media.pause();
        video.pause();
      } else {
        engine.pause();
      }
      setState();
    }

    async function toggle() {
      const st = engine.status();
      if (mode === "media") {
        if (!media.getAttribute("src") && !video.getAttribute("src")) return invite();
        const node = mediaNode();
        if (!node.paused) return enterMa();
        try {
          await node.play();
        } catch (err) {
          kernel.log(`oto: ${err.message}`, "oto");
        }
        setState();
        return;
      }
      if (st.playing && st.paused) {
        await engine.resume();
        setState();
        return;
      }
      if (st.playing) return enterMa();
      return invite();
    }

    function send() {
      engine.stop();
      stopMedia();
      mode = "score";
      setState();
    }

    function move(delta) {
      if (!seats.length) return;
      pick = (pick + delta + seats.length) % seats.length;
      setState();
    }

    function seekTo(ratio) {
      if (mode !== "media") return;
      const n = mediaNode();
      if (!n.duration || !Number.isFinite(n.duration)) return;
      n.currentTime = Math.max(0, Math.min(1, ratio)) * n.duration;
      setState();
    }

    function paintSeats() {
      const host = el.querySelector("#oto-seats");
      if (!host) return;
      host.replaceChildren();
      for (const seat of seats) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.seat = seat.id;
        b.textContent = seat.title;
        host.appendChild(b);
      }
    }

    async function loadSeats(focusPath) {
      const live = liveScore(kernel);
      const rows = [
        {
          id: "live",
          kind: "score",
          title: live.title,
          path: "",
          score: live,
        },
      ];
      const dirs = ["/etc/oto", `/home/${kernel.state.ujiko}/oto`];
      for (const dir of dirs) {
        try {
          const list = await kernel.vfs.ls(dir);
          for (const f of list.filter((x) => x.type !== "dir")) {
            try {
              const file = await kernel.readPath(f.path);
              rows.push(seatFromFile(f.path, file));
            } catch (err) {
              /* skip */
            }
          }
        } catch (err) {
          /* no box */
        }
      }
      if (focusPath && !rows.some((r) => r.path === focusPath)) {
        try {
          rows.push(seatFromFile(focusPath, await kernel.readPath(focusPath)));
        } catch (err) {
          kernel.log(`oto: ${err.message}`, "oto");
        }
      }
      seats = rows;
      if (focusPath) {
        const i = seats.findIndex((s) => s.path === focusPath);
        if (i >= 0) pick = i;
      }
      paintSeats();
      setState();
    }

    function seatFromFile(path, file) {
      const name = path.split("/").pop() || path;
      if (looksMedia(path, file) && mediaUrl(file)) {
        return {
          id: seatId(path, name),
          kind: "media",
          title: name.replace(/\.[^.]+$/, ""),
          path,
          file,
        };
      }
      const score = parseScore(file.body || "");
      if (!score.title || score.title === "\u7121\u540d\u306e\u5ea7") score.title = name.replace(/\.oto$|\.kagura$/i, "");
      return { id: seatId(path, score.title), kind: "score", title: score.title, path, score, file };
    }

    async function uniquePath(dir, name) {
      let dest = `${dir}/${name}`;
      if (!(await kernel.vfs.getFile(dest))) return dest;
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let i = 2;
      while (await kernel.vfs.getFile(`${dir}/${stem}-${i}${ext}`)) i += 1;
      return `${dir}/${stem}-${i}${ext}`;
    }

    async function ingestFiles(files) {
      const home = `/home/${kernel.state.ujiko}/oto`;
      let last = "";
      for (const file of files) {
        const mime = file.type || "";
        if (!mime.startsWith("audio/") && !mime.startsWith("video/")) continue;
        try {
          const data = await readFileAsData(file);
          const path = await uniquePath(home, safeName(file.name || "media"));
          await kernel.vfs.write(path, data, mime);
          last = path;
        } catch (err) {
          kernel.log(`oto: ${err.message}`, "oto");
        }
      }
      if (last) {
        kernel.emit("vfs", { path: last, op: "put" });
        await openSeat(last);
      }
    }

    async function onEnded() {
      if (engine.status().loop) {
        await invite();
        return;
      }
      move(1);
      await invite();
    }

    function onCmd(ev) {
      const now = kernel.state.oto || {};
      if (now.pid && now.pid !== pid) return;
      const act = ev.detail && ev.detail.act;
      if (act === "toggle") toggle();
      else if (act === "ma") enterMa();
      else if (act === "invite") invite();
      else if (act === "next") {
        move(1);
        invite();
      } else if (act === "prev") {
        move(-1);
        invite();
      } else if (act === "send") send();
    }

    function bindOnce() {
      if (bound) return;
      bound = true;
      el.innerHTML = `
        <p class="lede">\u97f3\u970a</p>
        <p class="muted" id="oto-now">\u5ea7\u3092\u62db\u3051\u3002</p>
        <canvas id="oto-field" width="560" height="160" aria-hidden="true"></canvas>
        <div id="oto-meter" role="slider" aria-label="\u7e01"><i id="oto-meter-fill"></i></div>
        <div class="oto-stage" hidden></div>
        <div class="boot-actions" style="margin:12px 0;justify-content:flex-start;flex-wrap:wrap">
          <button class="btn primary" type="button" id="oto-invite">\u62db\u304f</button>
          <button class="btn" type="button" id="oto-ma">\u9593</button>
          <button class="btn" type="button" id="oto-send">\u9001\u308b</button>
          <button class="btn is-on" type="button" id="oto-loop">\u5de1\u308b</button>
          <button class="btn" type="button" id="oto-prev">\u524d\u306e\u5ea7</button>
          <button class="btn" type="button" id="oto-next">\u6b21\u306e\u5ea7</button>
        </div>
        <label class="oto-en">\u7e01 <input id="oto-en" type="range" min="0" max="100" value="42" /></label>
        <div id="oto-seats" class="oto-seats"></div>
        <p class="muted">\u97f3\u306f\u6bba\u3055\u306a\u3044\u3002\u5bb6\u306b\u623b\u3063\u3066\u3082\u9cf4\u308b\u3002\u672d\u306e .oto \u306f\u5ea7\u306e\u8b5c\u3002</p>
      `;
      const stage = el.querySelector(".oto-stage");
      stage.append(video);
      el.querySelector("#oto-invite").onclick = () => invite();
      el.querySelector("#oto-ma").onclick = () => enterMa();
      el.querySelector("#oto-send").onclick = () => send();
      el.querySelector("#oto-loop").onclick = () => {
        const on = !engine.status().loop;
        engine.setLoop(on);
        media.loop = on;
        video.loop = on;
        setState();
      };
      el.querySelector("#oto-prev").onclick = () => move(-1);
      el.querySelector("#oto-next").onclick = () => move(1);
      el.querySelector("#oto-en").addEventListener("input", (e) => {
        const v = Number(e.target.value) / 100;
        engine.setEn(v);
        media.volume = v;
        video.volume = v;
      });
      el.querySelector("#oto-seats").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-seat]");
        if (!btn) return;
        const i = seats.findIndex((s) => s.id === btn.dataset.seat);
        if (i < 0) return;
        pick = i;
        setState();
        invite();
      });
      el.querySelector("#oto-meter").addEventListener("click", (e) => {
        const box = e.currentTarget.getBoundingClientRect();
        if (!box.width) return;
        seekTo((e.clientX - box.left) / box.width);
      });
      engine.setOnBeat(() => {
        pulse = 1;
      });
      media.addEventListener("play", setState);
      media.addEventListener("pause", setState);
      media.addEventListener("ended", onEnded);
      video.addEventListener("play", () => {
        stage.hidden = false;
        setState();
      });
      video.addEventListener("pause", setState);
      video.addEventListener("ended", onEnded);
      el.addEventListener("dragover", (e) => {
        if ([...((e.dataTransfer && e.dataTransfer.items) || [])].some((i) => i.kind === "file")) {
          e.preventDefault();
          el.classList.add("is-drop");
        }
      });
      el.addEventListener("dragleave", () => el.classList.remove("is-drop"));
      el.addEventListener("drop", (e) => {
        const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
        el.classList.remove("is-drop");
        if (!files.length) return;
        e.preventDefault();
        e.stopPropagation();
        ingestFiles(files);
      });
      el.tabIndex = -1;
      el.addEventListener("keydown", (e) => {
        if (e.target && e.target.tagName === "INPUT") return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          toggle();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          send();
        }
      });
      kernel.addEventListener("oto-cmd", onCmd);
    }

    async function openSeat(path) {
      if (!path) return;
      kernel.noteRecent(path);
      await loadSeats(path);
      await invite();
    }

    bindOnce();
    engine.setEn(0.42);
    media.volume = 0.42;
    video.volume = 0.42;
    const bootPath = (offer && offer.path) || startPath || "";
    loadSeats(bootPath.endsWith(".gate") ? "" : bootPath).then(() => {
      if (bootPath && !bootPath.endsWith(".gate")) invite();
    });
    raf = window.requestAnimationFrame(tickViz);

    return {
      el,
      title: "otodama",
      onFocus() {
        el.focus();
      },
      onPause() {},
      onResume() {},
      onDrop(paths) {
        const first = (paths || []).find(Boolean);
        if (first) openSeat(first);
      },
      onOffer(next) {
        if (next && next.path) openSeat(next.path);
      },
      onClose() {
        kernel.removeEventListener("oto-cmd", onCmd);
        send();
        if ((kernel.state.oto || {}).pid === pid || (kernel.state.oto || {}).state === "still") {
          kernel.noteOto({ title: "", path: "", state: "still", pid: 0 });
        }
        engine.dispose();
        if (raf) cancelAnimationFrame(raf);
      },
    };
  },
};
