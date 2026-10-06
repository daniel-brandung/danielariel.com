// Regenerates public/daniel-ariel-cv.pdf from the /cv route with headless Chrome.
//
//   npm run cv:pdf
//
// Uses the server at CV_URL (default http://localhost:3100/cv) if one answers;
// otherwise starts `next dev` on that port for the run. CHROME_PATH overrides
// the Chrome binary. Exits non-zero if the CV no longer fits on one page.
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { promisify } from "node:util";

const url = process.env.CV_URL ?? "http://localhost:3100/cv";
const out = "public/daniel-ariel-cv.pdf";
const chrome =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function reachable() {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

let server;
if (!(await reachable())) {
  const port = new URL(url).port || "3100";
  console.log(`No server at ${url}, starting next dev on port ${port}…`);
  // its own process group, so the dev server's workers stop with it
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", port], {
    stdio: "ignore",
    detached: true,
  });
  const deadline = Date.now() + 90_000;
  while (!(await reachable())) {
    if (Date.now() > deadline) {
      process.kill(-server.pid);
      throw new Error(`Dev server did not answer at ${url} within 90s`);
    }
    await sleep(500);
  }
}

try {
  await promisify(execFile)(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--generate-pdf-document-outline",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${out}`,
    url,
  ]);
} finally {
  if (server) process.kill(-server.pid);
}

const pdf = await readFile(out, "latin1");
const pages = (pdf.match(/\/Type\s*\/Page(?![a-z])/g) ?? []).length;
const kb = Math.round(Buffer.byteLength(pdf, "latin1") / 1024);
console.log(`Wrote ${out}: ${pages} page${pages === 1 ? "" : "s"}, ${kb} KB`);
if (pages !== 1) {
  console.error("The CV should fit on one A4 page; tighten app/cv/page.tsx.");
  process.exitCode = 1;
}
