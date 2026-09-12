export async function runOsLayers({ page, h, browser, base, sleep, note, section, attachPage, fails }) {
  await section("konoyo", async () => {
    note(await page.evaluate(() => document.documentElement.dataset.konoyo === "1" || document.documentElement.dataset.konoyo === "0"), "\u6b64\u5cb8 dataset");
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] [data-mark='/konoyo']")), "\u7e01fs \u6b64\u5cb8\u30de\u30fc\u30af");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-bind")), "\u6b64\u5cb8\u3092\u7d50\u3076");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-take")), "\u73fe\u4e16\u304b\u3089\u53d7\u3051\u308b");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-send")), "\u73fe\u4e16\u3078\u51fa\u3059");
    await page.evaluate(() => document.querySelector(".window[data-app=fs] [data-mark='/konoyo']")?.click());
    await sleep(280);
    const shoreList = await page.$$eval(".window[data-app=fs] .fs-tree [data-path]", (els) =>
      els.map((b) => b.dataset.path || "")
    );
    note(shoreList.some((p) => p === "/konoyo" || p.includes("/konoyo") || p.includes("\u7d50\u3073")), `\u6b64\u5cb8\u306e\u5323 ${shoreList.slice(0, 4).join(" ")}`);
    await h.closeWin("fs");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("ls /konoyo");
    await h.term("cat /proc/konoyo");
    const procK = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/supported=/.test(procK), `proc konoyo ${procK.slice(-80)}`);
    const bound = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.konoyo.bindMemory("e2e", {
        "hello.ofuda": "from-shore",
        "box/n.txt": "nest",
      });
      const a = await kernel.vfs.read("/konoyo/e2e/hello.ofuda");
      await kernel.vfs.write("/konoyo/e2e/wrote.ofuda", "back-to-shore");
      const home = `/home/${kernel.state.ujiko}/from-shore.ofuda`;
      await kernel.vfs.copy("/konoyo/e2e/hello.ofuda", home);
      const copied = await kernel.vfs.read(home);
      const wrote = await kernel.vfs.read("/konoyo/e2e/wrote.ofuda");
      const kids = await kernel.vfs.ls("/konoyo/e2e");
      const hits = await kernel.vfs.find("/konoyo/e2e", "hello");
      const greps = await kernel.vfs.grep("/konoyo/e2e", "nest");
      return {
        body: a.body,
        copied: copied.body,
        wrote: wrote.body,
        names: kids.map((k) => k.name).join(","),
        found: hits.some((f) => (f.path || "").includes("hello")),
        grep: greps.some((l) => String(l).includes("nest")),
        supported: document.documentElement.dataset.konoyo,
      };
    });
    note(bound.body === "from-shore", `\u6b64\u5cb8 cat ${bound.body}`);
    note(bound.copied === "from-shore", "\u6b64\u5cb8\u304b\u3089\u7e01fs\u3078\u5199\u3059");
    note(bound.wrote === "back-to-shore", "\u6b64\u5cb8\u3078\u66f8\u304f");
    note(/hello\.ofuda/.test(bound.names) && /wrote\.ofuda/.test(bound.names), `\u6b64\u5cb8 ls ${bound.names}`);
    note(bound.found, "\u6b64\u5cb8 find");
    note(bound.grep, "\u6b64\u5cb8 grep");
    await h.term("ls /konoyo/e2e");
    await h.term("cat /konoyo/e2e/hello.ofuda");
    await h.term("konoyo");
    const lsOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/hello\.ofuda/.test(lsOut) && /from-shore/.test(lsOut), "\u5949\u7d0d\u304b\u3089\u6b64\u5cb8\u3092\u8aad\u3080");
    note(/bind\te2e/.test(lsOut) && /awake/.test(lsOut), "\u5949\u7d0d konoyo \u8868");
    await h.closeWin("term");
    note(await page.evaluate(() =>
      [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "konoyo")
    ), "\u5353\u306b\u6b64\u5cb8\u306e\u5370");
  });

  await section("watari", async () => {
    note(
      await page.evaluate(() => {
        const v = document.documentElement.dataset.watari;
        return v === "still" || v === "0" || v === "live" || v === "calling" || v === "ma";
      }),
      "\u6e21\u308a dataset"
    );
    await h.openTorii("\u6e21\u308a", "watari");
    note(!!(await page.$(".window[data-app=watari] #watari-invite")), "\u6e21\u308a \u62db\u304f");
    await h.closeWin("watari");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("cat /proc/watari");
    const procW = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/supported=/.test(procW), `proc watari ${procW.slice(-80)}`);
    const looped = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const home = `/home/${kernel.state.ujiko}/watari-loop.ofuda`;
      await kernel.vfs.write(home, "loop-fuda");
      await kernel.watari.bindLoop();
      await kernel.watari.sendPath(home);
      const deadline = Date.now() + 5000;
      let body = "";
      let names = "";
      while (Date.now() < deadline) {
        const kids = await kernel.vfs.ls("/var/watari");
        names = kids.map((k) => k.name).join(",");
        for (const k of kids) {
          if (k.type === "dir") continue;
          const f = await kernel.vfs.read(k.path);
          if (String(f.body || "").includes("loop-fuda")) {
            body = f.body;
            break;
          }
        }
        if (body) break;
        await new Promise((r) => setTimeout(r, 120));
      }
      const snap = kernel.watari.snapshot();
      const live = snap.status === "live" || document.documentElement.dataset.watari === "live";
      await kernel.watari.close();
      return { live, body, names, supported: snap.via };
    });
    note(looped.live, "bindLoop live");
    note(looped.body === "loop-fuda", `\u6e21\u308a loop ${looped.body} ${looped.names}`);
    await h.closeWin("term");

    const pageB = await browser.newPage();
    pageB._yaoUrl = base;
    pageB.setDefaultTimeout(25000);
    await pageB.setViewport({ width: 1400, height: 900 });
    const hB = attachPage(pageB, { fails, note });
    await hB.boot();
    const pair = await Promise.all([
      page.evaluate(async () => {
        const { kernel } = await import("/js/kernel.js");
        await kernel.vfs.write(`/home/${kernel.state.ujiko}/watari-shrine.ofuda`, "shrine-fuda");
        await kernel.watari.open({ via: "shrine", kotoba: "e2e-watari" });
        await kernel.watari.waitLive(14000);
        await kernel.watari.sendPath(`/home/${kernel.state.ujiko}/watari-shrine.ofuda`);
        return {
          status: kernel.watari.snapshot().status,
          watari: document.documentElement.dataset.watari,
        };
      }),
      pageB.evaluate(async () => {
        const { kernel } = await import("/js/kernel.js");
        await kernel.watari.join({ via: "shrine", kotoba: "e2e-watari" });
        await kernel.watari.waitLive(14000);
        const deadline = Date.now() + 8000;
        let body = "";
        let dest = "";
        let names = "";
        while (Date.now() < deadline) {
          const kids = await kernel.vfs.ls("/var/watari");
          names = kids.map((k) => k.name).join(",");
          for (const k of kids) {
            if (k.type === "dir") continue;
            const f = await kernel.vfs.read(k.path);
            if (String(f.body || "").includes("shrine-fuda")) {
              body = f.body;
              dest = k.path;
              break;
            }
          }
          if (body) break;
          await new Promise((r) => setTimeout(r, 160));
        }
        return {
          status: kernel.watari.snapshot().status,
          watari: document.documentElement.dataset.watari,
          body,
          dest,
          names,
        };
      }),
    ]);
    note(pair[0].status === "live" || pair[0].watari === "live", `\u6e21\u308a A live ${pair[0].status}`);
    note(pair[1].status === "live" || pair[1].watari === "live", `\u6e21\u308a B live ${pair[1].status}`);
    note(pair[1].body === "shrine-fuda", `\u6e21\u308a shrine ${pair[1].body} ${pair[1].names}`);
    await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.watari.close();
    });
    await pageB.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.watari.close();
    });
    await pageB.close();
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "watari")
      ),
      "\u5353\u306b\u6e21\u308a\u306e\u5370"
    );
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] [data-mark='/var/watari']")), "\u7e01fs \u6e21\u308a\u30de\u30fc\u30af");
    await h.closeWin("fs");
  });

  await section("utsushi", async () => {
    note(
      await page.evaluate(() => {
        const v = document.documentElement.dataset.utsushi;
        return v === "live" || v === "still" || v === "0";
      }),
      "\u5199\u3057 dataset"
    );
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "utsushi")
      ),
      "\u5353\u306b\u5199\u3057\u306e\u5370"
    );
    const snapped = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const hit = await kernel.utsushi.snap({ reason: "e2e" });
      const kids = await kernel.vfs.ls("/var/utsushi");
      const names = kids.map((k) => k.name).join(",");
      const png = kids.filter((k) => /\.png$/i.test(k.name));
      let body = "";
      if (png.length) {
        const f = await kernel.vfs.read(png[png.length - 1].path);
        body = String(f.body || "").slice(0, 22);
      }
      return {
        path: hit.path,
        bytes: hit.bytes,
        names,
        body,
        last: kernel.utsushi.snapshot().last,
        ds: document.documentElement.dataset.utsushi,
        proc: kernel.utsushi.procText(),
      };
    });
    note(!!snapped.path && /\/var\/utsushi\//.test(snapped.path), `\u5199\u3057 path ${snapped.path}`);
    note(snapped.bytes > 80, `\u5199\u3057 bytes ${snapped.bytes}`);
    note(snapped.body.startsWith("data:image/png"), `\u5199\u3057 body ${snapped.body}`);
    note(/supported=1/.test(snapped.proc) && /count=/.test(snapped.proc), `proc utsushi ${snapped.proc.slice(0, 80)}`);
    await h.openTorii("\u93e1", "kagami");
    note(!!(await page.$(".window[data-app=kagami] #kagami-snap")), "\u93e1 \u6620\u3059");
    note(!!(await page.$(".window[data-app=kagami] #kagami-img")), "\u93e1 \u753b");
    await page.evaluate(() => document.querySelector(".window[data-app=kagami] #kagami-snap")?.click());
    await sleep(400);
    const after = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const kids = await kernel.vfs.ls("/var/utsushi");
      return kids.filter((k) => /\.png$/i.test(k.name)).length;
    });
    note(after >= 2, `\u93e1\u304b\u3089\u6620\u3059 ${after}`);
    await h.closeWin("kagami");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("cat /proc/utsushi");
    const procU = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/supported=/.test(procU) && /last=/.test(procU), `term proc utsushi ${procU.slice(-80)}`);
    await h.closeWin("term");
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] [data-mark='/var/utsushi']")), "\u7e01fs \u5199\u3057\u30de\u30fc\u30af");
    await h.closeWin("fs");
    await h.desk();
    await h.key("F8");
    await sleep(300);
    const f8 = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      return kernel.utsushi.snapshot().count;
    });
    note(f8 >= 3, `F8 \u5199\u3057 count=${f8}`);
  });

  await section("keshiki", async () => {
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "keshiki")
      ),
      "\u5353\u306b\u666f\u8272\u306e\u5370"
    );
    const laid = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const hit = await kernel.keshiki.fromLast();
      return {
        path: hit.path,
        has: hit.has,
        ds: document.documentElement.dataset.keshiki,
        scale: document.documentElement.dataset.scale,
        veil: !document.getElementById("keshiki-veil")?.hidden,
        field: document.getElementById("kami-field")?.hidden === true,
        proc: kernel.keshiki.procText(),
      };
    });
    note(!!laid.path && /\/var\/utsushi\//.test(laid.path), `\u666f\u8272 path ${laid.path}`);
    note(laid.has && laid.ds === "1", `\u666f\u8272 dataset ${laid.ds}`);
    note(laid.veil, "keshiki veil");
    note(laid.field, "kami-field paused");
    note(/path=/.test(laid.proc) && /scale=/.test(laid.proc), `proc keshiki ${laid.proc.slice(0, 80)}`);
    await h.openTorii("\u6a5f\u68b0", "sys");
    note(!!(await page.$(".window[data-app=sys] #sys-keshiki-last")), "\u6a5f\u68b0 \u6577\u304f");
    note(!!(await page.$(".window[data-app=sys] [data-scale='1.15']")), "\u6a5f\u68b0 \u62e1\u5927");
    await page.evaluate(() => document.querySelector(".window[data-app=sys] [data-scale='1.15']")?.click());
    await sleep(200);
    const scaled = await page.evaluate(() => ({
      ds: document.documentElement.dataset.scale,
      css: getComputedStyle(document.documentElement).getPropertyValue("--ui-scale").trim(),
    }));
    note(scaled.ds === "1.15" || scaled.css === "1.15", `\u62e1\u5927 ${scaled.ds} ${scaled.css}`);
    await page.evaluate(() => document.querySelector(".window[data-app=sys] [data-scale='1']")?.click());
    await sleep(120);
    await h.closeWin("sys");
    await h.openTorii("\u93e1", "kagami");
    note(!!(await page.$(".window[data-app=kagami] #kagami-desk")), "\u93e1 \u5353\u3078");
    await page.evaluate(() => document.querySelector(".window[data-app=kagami] #kagami-desk")?.click());
    await sleep(240);
    await h.closeWin("kagami");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("cat /proc/keshiki");
    const procK = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/path=/.test(procK) && /has=1/.test(procK), `term proc keshiki ${procK.slice(-80)}`);
    await h.term("keshiki clear");
    const cleared = await page.evaluate(() => document.documentElement.dataset.keshiki);
    note(cleared === "0", `\u666f\u8272 clear ${cleared}`);
    await h.closeWin("term");
  });

  await section("utsuwa-okoshi", async () => {
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "utsuwa")
      ),
      "\u5353\u306b\u5668\u306e\u5370"
    );
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "okoshi")
      ),
      "\u5353\u306b\u8d77\u3053\u3057\u306e\u5370"
    );
    const before = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const p = `/home/${kernel.state.ujiko}/sweep-probe.ofuda`;
      await kernel.vfs.write(p, "sweep-body");
      await kernel.vfs.moveToMuen(p);
      const hit = await kernel.utsuwa.sweep({ hard: true });
      await kernel.okoshi.add("sys");
      return {
        dropped: hit.dropped,
        proc: kernel.utsuwa.procText(),
        oshi: kernel.okoshi.procText(),
        ds: document.documentElement.dataset.utsuwa,
        quota: kernel.vfs.quotaOf(),
      };
    });
    note(before.dropped >= 1, `\u5668 sweep ${before.dropped}`);
    note(/bytes=/.test(before.proc) && /quota=/.test(before.proc), `proc utsuwa ${before.proc.slice(0, 80)}`);
    note(before.ds === "live" || before.ds === "full", `\u5668 dataset ${before.ds}`);
    note(before.quota > 0, `\u5668 quota ${before.quota}`);
    note(/app=sys/.test(before.oshi), `okoshi ${before.oshi}`);
    await h.openTorii("\u6a5f\u68b0", "sys");
    note(!!(await page.$(".window[data-app=sys] #sys-utsuwa-sweep")), "\u6a5f\u68b0 \u6383\u304f");
    note(!!(await page.$(".window[data-app=sys] [data-okoshi=sys]")), "\u6a5f\u68b0 \u8d77\u3053\u3057");
    await page.evaluate(() => document.querySelector(".window[data-app=sys] #sys-utsuwa-sweep")?.click());
    await sleep(200);
    await h.closeWin("sys");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("df");
    await h.term("cat /proc/utsuwa");
    await h.term("okoshi list");
    const termOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/quota=/.test(termOut), `term df/utsuwa ${termOut.slice(-80)}`);
    note(/app=sys/.test(termOut), `term okoshi ${termOut.slice(-60)}`);
    await h.closeWin("term");
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] #fs-sweep")), "\u7e01fs \u6383\u304f");
    await h.closeWin("fs");
  });

  await section("kagi", async () => {
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "kagi")
      ),
      "\u5353\u306b\u9375\u306e\u5370"
    );
    const locked = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      kernel.kagi.lock();
      return {
        ds: document.documentElement.dataset.kagi,
        open: document.getElementById("kagi-veil")?.classList.contains("open"),
        proc: kernel.kagi.procText(),
        ujiko: kernel.state.ujiko,
      };
    });
    note(locked.ds === "1" && locked.open, `\u9375 lock ${locked.ds}`);
    note(/locked=1/.test(locked.proc), `proc kagi ${locked.proc}`);
    await page.evaluate((name) => {
      const input = document.getElementById("kagi-kotoba");
      if (input) input.value = name;
      document.getElementById("kagi-open")?.click();
    }, locked.ujiko);
    await sleep(200);
    const opened = await page.evaluate(() => ({
      ds: document.documentElement.dataset.kagi,
      open: document.getElementById("kagi-veil")?.classList.contains("open"),
    }));
    note(opened.ds === "0" && !opened.open, `\u9375 unlock ${opened.ds}`);
    await h.desk();
    await h.key("F9");
    await sleep(200);
    note(await page.evaluate(() => document.documentElement.dataset.kagi === "1" && document.getElementById("kagi-veil")?.classList.contains("open")), "F9 \u9375");
    await page.evaluate(() => document.getElementById("kagi-kashiwa")?.click());
    await sleep(200);
    await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=left]")?.click());
    await sleep(80);
    await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=right]")?.click());
    await sleep(1600);
    await h.closeKashiwa();
    note(await page.evaluate(() => document.documentElement.dataset.kagi === "0"), "\u67cf\u624b\u3067\u9375\u3092\u5916\u3059");
    await page.click("#kagi-pill");
    await sleep(200);
    note(await page.evaluate(() => document.documentElement.dataset.kagi === "1"), "\u9375pill");
    await page.evaluate((name) => {
      const input = document.getElementById("kagi-kotoba");
      if (input) input.value = name;
      document.getElementById("kagi-open")?.click();
    }, locked.ujiko);
    await sleep(200);
    note(await page.evaluate(() => document.documentElement.dataset.kagi === "0"), "\u9375pill \u3092\u5916\u3059");
    await h.openTorii("\u6a5f\u68b0", "sys");
    note(!!(await page.$(".window[data-app=sys] #sys-kagi-lock")), "\u6a5f\u68b0 \u9375");
    await h.closeWin("sys");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("cat /proc/kagi");
    await h.term("kagi lock");
    const lockedTerm = await page.evaluate(() => document.documentElement.dataset.kagi);
    note(lockedTerm === "1", `term kagi lock ${lockedTerm}`);
    await h.term("kagi unlock");
    await h.term("cat /proc/kagi");
    const kagiOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/locked=0/.test(kagiOut), `term kagi ${kagiOut.slice(-40)}`);
    note(await page.evaluate(() => document.documentElement.dataset.kagi === "0"), "term kagi unlock");
    await h.closeWin("term");
  });

}
