export function startField(canvas, kernel) {
  const ctx = canvas.getContext("2d");
  const particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resize);
  resize();

  function spawn(kind, x, y) {
    const w = canvas.width;
    const h = canvas.height;
    if (kind === "hitodama") {
      return {
        kind,
        x: x ?? Math.random() * w,
        y: y ?? Math.random() * h,
        r: Math.random() * 3.2 + 1.4,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -0.12 - Math.random() * 0.22,
        a: Math.random() * 0.35 + 0.2,
      };
    }
    if (kind === "muen") {
      return {
        kind,
        x: x ?? Math.random() * w,
        y: y ?? Math.random() * h,
        r: Math.random() * 2.2 + 1.2,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        a: 0.55,
      };
    }
    return {
      kind: "kami",
      x: x ?? Math.random() * w,
      y: y ?? Math.random() * h,
      r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.45 + 0.08,
    };
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const kamiN = reduced ? 24 : 56;
  for (let i = 0; i < kamiN; i += 1) particles.push(spawn("kami"));
  for (let i = 0; i < (reduced ? 2 : 5); i += 1) particles.push(spawn("hitodama"));

  function color(p) {
    if (p.kind === "muen") return `rgba(194, 58, 43, ${p.a})`;
    if (p.kind === "hitodama") return `rgba(244, 234, 216, ${p.a})`;
    return `rgba(230, 201, 106, ${p.a})`;
  }

  let raf = 0;
  let lastTs = 0;
  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = color(p);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function deskBusy() {
    return document.getElementById("desktop")?.classList.contains("is-app");
  }

  function shouldRun() {
    return !document.hidden && !kernel.state.maLocked && !deskBusy();
  }

  function tick(ts) {
    raf = 0;
    if (!shouldRun()) return;
    if (ts && ts - lastTs < 40) {
      raf = requestAnimationFrame(tick);
      return;
    }
    lastTs = ts || 0;
    const now = Date.now();
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === "hitodama") p.a = 0.18 + Math.abs(Math.sin(now / 700 + p.x)) * 0.35;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
    }
    draw(now);
    if (!reduced) raf = requestAnimationFrame(tick);
  }
  function resume() {
    if (shouldRun() && !raf) raf = requestAnimationFrame(tick);
  }
  document.addEventListener("visibilitychange", resume);
  kernel.addEventListener("ma", resume);
  const desk = document.getElementById("desktop");
  if (desk && typeof MutationObserver !== "undefined") {
    new MutationObserver(resume).observe(desk, { attributes: true, attributeFilter: ["class"] });
  }
  tick();

  function burst(kind = "hitodama", n = 12) {
    for (let i = 0; i < n; i += 1) particles.push(spawn(kind));
    if (particles.length > 220) particles.splice(0, particles.length - 220);
  }

  function spawnMuen(packet) {
    const x = (packet.x || Math.random()) * canvas.width;
    const y = (packet.y || Math.random()) * canvas.height;
    particles.push(spawn("muen", x, y));
  }

  kernel.addEventListener("muen", (ev) => spawnMuen(ev.detail || {}));

  return { burst, spawnMuen };
}
