import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve("rashfa-wa-khubza-live/index.html");
const html = readFileSync(file, "utf8");
const failures = [];

const count = (re) => (html.match(re) ?? []).length;
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

if (!/^<!doctype html>/i.test(html.trim())) failures.push("Missing HTML5 doctype");
if (count(/<html\b/gi) !== 1 || count(/<\/html>/gi) !== 1) failures.push("HTML root is not balanced");
if (count(/<head\b/gi) !== 1 || count(/<\/head>/gi) !== 1) failures.push("HEAD is not balanced");
if (count(/<body\b/gi) !== 1 || count(/<\/body>/gi) !== 1) failures.push("BODY is not balanced");
if (count(/<style>/gi) !== 1 || count(/<\/style>/gi) !== 1) failures.push("Unexpected STYLE tag count");
if (ids.length !== new Set(ids).size) failures.push("Duplicate HTML ids detected");
if (!html.includes('<meta name="description"')) failures.push("Missing description meta");
if (!html.includes('<link rel="canonical"')) failures.push("Missing canonical link");
if (!html.includes('application/ld+json')) failures.push("Missing Restaurant JSON-LD");
if (!/"@type":"Restaurant"/.test(html)) failures.push("JSON-LD is not Restaurant");
if (!html.includes("rashfeh_khubze")) failures.push("Official Instagram handle missing");
if (!html.includes("share.google/pxUZ6dJH01WAfEi3u")) failures.push("Verified Google Maps share link missing");
if (!html.includes("talabat.com/oman/restaurants/2601/sohar-sanaiyah")) failures.push("Talabat source link missing");
if ((html.match(/target="_blank"/gi) ?? []).length !== (html.match(/rel="noopener noreferrer"/gi) ?? []).length) failures.push("Unsafe target=_blank link count mismatch");
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
  if (!html.includes(`id="${id}"`)) failures.push(`Broken internal anchor: #${id}`);
}
if (/<style>[\s\S]*<style>/i.test(html)) failures.push("Nested STYLE tag detected");

if (failures.length) {
  console.error("RASHFA QA FAILED");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log(JSON.stringify({
  status: "PASS",
  file,
  bytes: Buffer.byteLength(html),
  ids: ids.length,
  anchors: [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]).length,
  instagramLinks: count(/instagram\.com\/rashfeh_khubze/gi),
  talabatLinks: count(/talabat\.com/gi)
}, null, 2));
