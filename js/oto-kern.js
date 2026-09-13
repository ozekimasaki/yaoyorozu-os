const SCORES = [
  [
    "\u67cf\u624b.oto",
    "# \u97f3\u970a\ntitle \u67cf\u624b\nbpm 88\nwave triangle\nroot 220\nsteps 0 0 7 0\ndecay 0.45\nnoise 0.12\nbell 0\ndrone 0\nclap 2\n",
  ],
  [
    "\u9593.oto",
    "# \u97f3\u970a\ntitle \u9593\nbpm 36\nwave sine\nroot 98\nsteps 0 7\ndecay 3.4\nnoise 0.01\nbell 1\ndrone 0.14\nclap 0\n",
  ],
  [
    "\u96e8\u5bbf\u308a.oto",
    "# \u97f3\u970a\ntitle \u96e8\u5bbf\u308a\nbpm 58\nwave sine\nroot 147\nsteps 0 2 3 7 3 2\ndecay 2.4\nnoise 0.16\nbell 0\ndrone 0.06\nclap 0\n",
  ],
  [
    "\u6df1\u591c\u30e9\u30b8\u30aa.oto",
    "# \u97f3\u970a\ntitle \u6df1\u591c\u30e9\u30b8\u30aa\nbpm 64\nwave triangle\nroot 174\nsteps 0 5 7 10 7 5 3 0\ndecay 1.8\nnoise 0.05\nbell 1\ndrone 0.18\nclap 0\n",
  ],
  [
    "\u7ac8.oto",
    "# \u97f3\u970a\ntitle \u7ac8\nbpm 48\nwave triangle\nroot 123\nsteps 0 3 5 7 5 3\ndecay 2.6\nnoise 0.02\nbell 1\ndrone 0.12\nclap 0\n",
  ],
];

export function attachOto(kernel) {
  if (!kernel || kernel.noteOto) return kernel;
  if (kernel.state && !kernel.state.oto) {
    kernel.state.oto = { title: "", path: "", state: "still", pid: 0, kind: "" };
  }
  kernel.otoText = function otoText() {
    const o = (this.state && this.state.oto) || {};
    return `state=${o.state || "still"}\ntitle=${o.title || ""}\npath=${o.path || ""}\npid=${o.pid || 0}\nkind=${o.kind || ""}`;
  };
  kernel.noteOto = function noteOto(rec = {}) {
    if (!this.state) return null;
    if (!this.state.oto) this.state.oto = { title: "", path: "", state: "still", pid: 0, kind: "" };
    const state = rec.state === "live" || rec.state === "ma" ? rec.state : "still";
    const next = {
      title: String(rec.title || ""),
      path: String(rec.path || ""),
      state,
      pid: rec.pid || 0,
      kind: String(rec.kind || ""),
    };
    this.state.oto = next;
    try {
      document.documentElement.dataset.oto = next.state;
      if (next.title) document.documentElement.dataset.otoTitle = next.title;
      else delete document.documentElement.dataset.otoTitle;
    } catch (err) {
      /* no dom */
    }
    this.emit("oto", next);
    return next;
  };
  kernel.otoCmd = function otoCmd(act) {
    const rec = { act: String(act || "") };
    this.emit("oto-cmd", rec);
    return rec;
  };
  seedOto(kernel);
  return kernel;
}

export async function seedOto(kernel) {
  if (!kernel || !kernel.vfs || kernel._otoSeeded) return;
  kernel._otoSeeded = true;
  try {
    await kernel.vfs.mkdir("/etc/oto");
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      await kernel.vfs.mkdir(`${home}/oto`);
      const gate = `${home}/desktop/\u97f3\u970a.gate`;
      if (!(await kernel.vfs.getFile(gate))) await kernel.vfs.write(gate, "oto", "gate/app");
    }
    for (const [name, body] of SCORES) {
      const path = `/etc/oto/${name}`;
      if (!(await kernel.vfs.getFile(path))) await kernel.vfs.write(path, body, "text/oto");
    }
  } catch (err) {
    /* seed later */
  }
}
