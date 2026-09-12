const WAVES = new Set(["sine", "triangle", "square", "sawtooth"]);

export function parseScore(text) {
  const rec = {
    title: "",
    bpm: 72,
    wave: "sine",
    root: 196,
    steps: [0, 3, 7, 12, 7, 3],
    decay: 1.6,
    noise: 0.04,
    bell: 1,
    drone: 0.1,
    clap: 0,
  };
  for (const line of String(text || "").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(" ");
    const k = i < 0 ? t : t.slice(0, i);
    const v = i < 0 ? "" : t.slice(i + 1).trim();
    if (k === "title") rec.title = v;
    else if (k === "bpm") rec.bpm = Math.max(24, Math.min(180, Number(v) || rec.bpm));
    else if (k === "wave" && WAVES.has(v)) rec.wave = v;
    else if (k === "root") rec.root = Math.max(40, Math.min(880, Number(v) || rec.root));
    else if (k === "steps") {
      const steps = v.split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
      if (steps.length) rec.steps = steps;
    } else if (k === "decay") rec.decay = Math.max(0.2, Math.min(6, Number(v) || rec.decay));
    else if (k === "noise") rec.noise = Math.max(0, Math.min(0.4, Number(v) || 0));
    else if (k === "bell") rec.bell = v === "0" ? 0 : 1;
    else if (k === "drone") rec.drone = Math.max(0, Math.min(0.4, Number(v) || 0));
    else if (k === "clap") rec.clap = Math.max(0, Math.min(16, Number(v) || 0) | 0);
  }
  if (!rec.title) rec.title = "\u7121\u540d\u306e\u5ea7";
  return rec;
}

export function mediaUrl(file) {
  const body = String((file && file.body) || "").trim();
  if (body.startsWith("data:audio") || body.startsWith("data:video")) return body;
  if (/^https?:\/\//i.test(body)) return body;
  return "";
}

export function looksMedia(path, file) {
  const mime = (file && file.mime) || "";
  if (mime.startsWith("audio/") || mime.startsWith("video/")) return true;
  if (mediaUrl(file)) return true;
  return /\.(mp3|ogg|oga|wav|m4a|webm|mp4)$/i.test(path || (file && file.path) || "");
}

export function looksVideo(path, file) {
  const mime = (file && file.mime) || "";
  const url = mediaUrl(file);
  if (mime.startsWith("video/")) return true;
  if (url.startsWith("data:video")) return true;
  return /\.(webm|mp4)$/i.test(path || (file && file.path) || "");
}

export function liveScore(kernel) {
  const o = kernel.state.oncall;
  const pref = kernel.spacePref();
  const seed = o.seed || 1;
  const waves = ["sine", "triangle", "sine", "triangle"];
  return {
    title: `${pref.name}\u306e${o.kami.name}`,
    bpm: 52 + (o.article % 18),
    wave: waves[seed % 4],
    root: 110 + (seed % 7) * 14,
    steps: [0, 3, 7, 10, 12, 7, 5, 3],
    decay: 2.1,
    drone: 0.08,
    noise: 0.03,
    bell: 1,
    clap: 0,
  };
}

export function createEngine() {
  let ctx = null;
  let master = null;
  let droneOsc = null;
  let droneGain = null;
  let timer = 0;
  let step = 0;
  let score = null;
  let playing = false;
  let paused = false;
  let loop = true;
  let en = 0.42;
  let onBeat = () => {};

  function ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = en;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  async function wake() {
    const c = ensure();
    if (c && c.state === "suspended") {
      try {
        await c.resume();
      } catch (err) {
        /* gesture */
      }
    }
    return c;
  }

  function tone(freq, dur, type, gain) {
    const c = ctx;
    if (!c || !master) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), c.currentTime + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  function burst(amount) {
    const c = ctx;
    if (!c || !master || amount <= 0) return;
    const n = Math.max(32, (c.sampleRate * 0.14) | 0);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.2));
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    g.gain.value = amount;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  function startDrone(freq, gain) {
    stopDrone();
    const c = ctx;
    if (!c || !master || gain <= 0) return;
    droneOsc = c.createOscillator();
    droneGain = c.createGain();
    droneOsc.type = "sine";
    droneOsc.frequency.value = Math.max(40, freq / 2);
    droneGain.gain.value = gain;
    droneOsc.connect(droneGain);
    droneGain.connect(master);
    droneOsc.start();
  }

  function stopDrone() {
    if (droneOsc) {
      try {
        droneOsc.stop();
      } catch (err) {
        /* ended */
      }
    }
    droneOsc = null;
    droneGain = null;
  }

  function beatMs() {
    return (60 / (score && score.bpm ? score.bpm : 72)) * 1000;
  }

  function tick() {
    if (!playing || paused || !score) return;
    const steps = score.steps && score.steps.length ? score.steps : [0];
    if (!loop && step >= steps.length) {
      stop();
      return;
    }
    const deg = steps[step % steps.length];
    const freq = score.root * 2 ** (deg / 12);
    if (score.clap && step % score.clap === 0) burst(0.5);
    else tone(freq, score.decay || 1.4, score.wave || "sine", 0.2);
    if (score.bell) tone(freq * 2, (score.decay || 1.4) * 0.55, "triangle", 0.07);
    if (score.noise) burst(score.noise);
    step += 1;
    onBeat({ step, freq, at: Date.now() });
    timer = window.setTimeout(tick, beatMs());
  }

  async function play(next) {
    score = next;
    step = 0;
    playing = true;
    paused = false;
    const c = await wake();
    if (!c) return status();
    startDrone(score.root, score.drone || 0);
    if (timer) clearTimeout(timer);
    tick();
    return status();
  }

  function pause() {
    if (!playing || paused) return status();
    paused = true;
    if (timer) clearTimeout(timer);
    timer = 0;
    stopDrone();
    if (ctx && ctx.state === "running") {
      ctx.suspend().catch(() => {});
    }
    return status();
  }

  async function resume() {
    if (!playing || !paused) return status();
    paused = false;
    await wake();
    if (score) startDrone(score.root, score.drone || 0);
    tick();
    return status();
  }

  function stop() {
    playing = false;
    paused = false;
    step = 0;
    if (timer) clearTimeout(timer);
    timer = 0;
    stopDrone();
    return status();
  }

  function setEn(v) {
    en = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.value = en;
    return en;
  }

  function setLoop(on) {
    loop = !!on;
    return loop;
  }

  function status() {
    return { playing, paused, loop, en, step, title: (score && score.title) || "" };
  }

  function setOnBeat(fn) {
    onBeat = typeof fn === "function" ? fn : () => {};
  }

  function dispose() {
    stop();
    if (ctx) {
      ctx.close().catch(() => {});
    }
    ctx = null;
    master = null;
  }

  return { play, pause, resume, stop, setEn, setLoop, status, setOnBeat, dispose, wake };
}
