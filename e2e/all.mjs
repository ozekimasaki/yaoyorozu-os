import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import {
  ROOT,
  sleep,
  freePort,
  startStatic,
  waitHttp,
  makeNote,
  attachPage,
} from "./harness.mjs";
