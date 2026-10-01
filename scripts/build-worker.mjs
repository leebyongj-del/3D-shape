import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const html = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
if (html.includes("$$")) {
  throw new Error("The Sites publishing pipeline rewrites '$$'. Use a named selector helper instead.");
}
const qr = fs.readFileSync(path.join(root, "site", "qr-code.png")).toString("base64");
let worker = fs.readFileSync(path.join(root, "worker", "index.js"), "utf8");
worker = worker.replace('"__SITE_PAGE_JSON__"', JSON.stringify(html));
worker = worker.replace('"__QR_BASE64__"', JSON.stringify(qr));
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "server"), { recursive: true });
fs.mkdirSync(path.join(dist, ".openai"), { recursive: true });
fs.writeFileSync(path.join(dist, "server", "index.js"), worker);
fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(dist, ".openai", "hosting.json"));
fs.cpSync(path.join(root, "drizzle"), path.join(dist, ".openai", "drizzle"), { recursive: true });
console.log("Built Cloudflare Worker artifact");
