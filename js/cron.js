const TOKIHO = "/etc/tokiho";

function parseKind(words) {
  const head = (words[0] || "").toLowerCase();
  if (head === "oshi" || head === "log" || head === "touch") {
    return { kind: head, payload: words.slice(1).join(" ").trim() };
  }
  return { kind: "oshi", payload: words.join(" ").trim() };
}

function parseWait(token) {
  const raw = String(token || "");
  const m = raw.match(/^\+?(\d+)([sm])?$/i);
  if (!m) return 0;
  const n = Number(m[1]);
  if (m[2] === "m") return n * 60;
  return n;
}

export async function attachCron(kernel) {
  let jobs = [];
  let running = false;

  async function load() {
    const saved = await kernel.vfs.metaGet("cron");
    jobs = Array.isArray(saved) ? saved : [];
  }

  async function save() {
    await kernel.vfs.metaSet("cron", jobs);
  }

  async function seed() {
    if (await kernel.vfs.getFile(TOKIHO)) return;
    await kernel.vfs.write(
      TOKIHO,
      [
        "tokiho \\u6642\\u5831",
        "cron                 list",
        "cron every <sec>     oshi text",
        "cron every <sec> log text",
        "cron at +<sec>       oshi text",
        "cron rm <id>",
        "at +<sec>            one shot",
        "atq / atrm <id>",
        "kami stay. no kill.",
      ].join("\n"),
      "text/plain"
    );
  }

  function list() {
    return jobs.slice();
  }

  function add(spec) {
    kernel.requireAuth();
    const every = Math.max(0, Number(spec.every) || 0);
    const wait = Math.max(0, Number(spec.wait) || 0);
    const kind = spec.kind === "log" || spec.kind === "touch" ? spec.kind : "oshi";
    const payload = String(spec.payload || "").trim();
    if (!payload) throw new Error("EINVAL");
    if (kind === "touch" && !payload.startsWith("/")) throw new Error("EINVAL");
    const rec = {
      id: `c${Date.now().toString(36)}${jobs.length.toString(36)}`,
      every,
      at: every ? 0 : Date.now() + Math.max(1, wait) * 1000,
      kind,
      payload: payload.slice(0, 180),
      last: Date.now(),
    };
    jobs = [...jobs, rec];
    save();
    kernel.log(`\\u6642\\u5831 ${rec.id}`, "cron");
    kernel.emit("cron");
    return rec;
  }

  function rm(id) {
    kernel.requireAuth();
    const next = jobs.filter((j) => j.id !== id);
    if (next.length === jobs.length) throw new Error("ENOENT");
    jobs = next;
    save();
    kernel.emit("cron");
    return id;
  }

  async function run(job) {
    if (job.kind === "log") kernel.log(job.payload, "cron");
    else if (job.kind === "touch") {
      await kernel.vfs.touch(job.payload);
    } else {
      kernel.noteOshi(job.payload, "cron");
    }
    job.last = Date.now();
    if (!job.every) jobs = jobs.filter((j) => j.id !== job.id);
    await save();
    kernel.emit("cron");
  }

  async function onTick() {
    if (running || !jobs.length) return;
    running = true;
    const now = Date.now();
    const due = jobs.filter((j) => (j.every ? now - (j.last || 0) >= j.every * 1000 : j.at && now >= j.at));
    try {
      for (const job of due) await run(job);
    } finally {
      running = false;
    }
  }

  await load();
  await seed();
  kernel.addEventListener("tick", onTick);
  kernel.cronAdd = add;
  kernel.cronList = list;
  kernel.cronRm = rm;
  kernel.cronParseKind = parseKind;
  kernel.cronParseWait = parseWait;
}
