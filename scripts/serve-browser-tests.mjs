import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = await realpath(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.env.BRINKWOOD_TEST_PORT ?? 4173);
const baselineCss = execFileSync("git", ["show", "HEAD:styles/blades.css"], { cwd: root, maxBuffer: 2_000_000 });
const mime = {
  ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".png": "image/png",
  ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff": "font/woff", ".woff2": "font/woff2",
};

// Serve only the fixture and its production dependencies, never repository metadata.
const server = createServer(async (request, response) => {
  try {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    let pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    if (pathname === "/") {
      response.writeHead(302, { Location: "/tests/browser/browser-regression-fixture.html" }).end();
      return;
    }
    if (pathname === "/styles/baseline.css") {
      response.writeHead(200, { "Content-Type": "text/css", "Cache-Control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : baselineCss);
      return;
    }
    if (!/^\/(tests\/browser|module|styles)\//.test(pathname)) {
      response.writeHead(404).end();
      return;
    }
    const path = await realpath(resolve(root, `.${pathname}`));
    if (!path.startsWith(root + sep) || !mime[extname(path)]) {
      response.writeHead(404).end();
      return;
    }
    const data = await readFile(path);
    response.writeHead(200, { "Content-Type": mime[extname(path)], "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Browser regression fixture: http://127.0.0.1:${port}/`);
});
