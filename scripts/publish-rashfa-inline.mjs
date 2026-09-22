#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const target = path.resolve(process.argv[2] || ".");
const root = path.join(target, "rashfa-wa-khubza-live");
const indexPath = path.join(root, "index.html");
const manifestPath = path.join(root, "data", "rashfa-menu-reconciliation.json");

const htmlEscape = s => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

async function imageData(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : ext === ".avif" ? "image/avif" : "image/jpeg";
  const data = await fs.readFile(file);
  return `data:${mime};base64,${data.toString("base64")}`;
}

const html = await fs.readFile(indexPath, "utf8");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const igDir = path.join(root, "assets", "instagram");
const menuDir = path.join(root, "assets", "menu");

const igFiles = (await fs.readdir(igDir)).filter(f => /\\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0, 6);
const menuFiles = (await fs.readdir(menuDir)).filter(f => /\\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0, 12);

let out = html;

if (igFiles.length) {
  const cards = [];
  for (const file of igFiles) {
    const src = await imageData(path.join(igDir, file));
    cards.push(`<figure class="local-photo"><img src="${src}" alt="صورة أصلية من حساب رشفة وخبزة الرسمي" loading="lazy"><figcaption>من الحساب الرسمي @rashfeh_khubze</figcaption></figure>`);
  }
  const gallery = `<div class="local-gallery" aria-label="معرض الصور الأصلي">${cards.join("")}</div>`;
  out = out.replace(/<div class="instagram-embed">[\\s\\S]*?<\\/div>\\s*<div class="instagram-fallback">/, `${gallery}<div class="instagram-fallback">`);
  out = out.replace(/<div class="instagram-stage photo-stage"[\\s\\S]*?<div class="photo-note">/, m => m);
}

const items = Array.isArray(manifest?.talabat?.items) ? manifest.talabat.items : [];
const usableItems = items.filter(x => x && x.price_omr && x.source_text && !/Rashfa\\s+wa\\s+Khobza/i.test(x.source_text)).slice(0, 60);

if (usableItems.length) {
  const cards = usableItems.map((item, idx) => {
    const lines = String(item.source_text).split(/\\n+/).map(s => s.trim()).filter(Boolean);
    const name = lines[0] || `صنف ${idx + 1}`;
    const description = lines.slice(1).join(" · ");
    const price = String(item.price_omr).replace(/^OMR\\s*/i, "");
    return `<article class="menu-item-local"><div><div class="menu-item-name">${htmlEscape(name)}</div>${description ? `<p>${htmlEscape(description)}</p>` : ""}</div><strong>${htmlEscape(price)} ر.ع.</strong></article>`;
  }).join("");
  const localMenu = `<div class="local-menu"><div class="local-menu-head"><span>القائمة المستخرجة من صفحة المطعم</span><span class="pill">مصدر طلبات</span></div>${cards}</div>`;
  out = out.replace(/<div class="menu-source-grid">[\\s\\S]*?<\\/div>\\s*<div class="verified-menu">/, `${localMenu}<div class="verified-menu">`);
}

if (menuFiles.length) {
  const cards = [];
  for (const file of menuFiles.slice(0, 8)) {
    const src = await imageData(path.join(menuDir, file));
    cards.push(`<figure class="local-photo"><img src="${src}" alt="صورة قائمة من مصدر طلبات" loading="lazy"><figcaption>صورة من مصدر طلبات</figcaption></figure>`);
  }
  const gallery = `<div class="local-menu-gallery" aria-label="صور القائمة من طلبات">${cards.join("")}</div>`;
  out = out.replace(/<div class="verified-menu">/, `${gallery}<div class="verified-menu">`);
}

if (igFiles.length || usableItems.length || menuFiles.length) {
  out = out.replace("</style>", `
.local-gallery,.local-menu-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px}
.local-photo{margin:0;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--white)}
.local-photo img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}
.local-photo figcaption{padding:10px 13px;color:#6b675e;font-size:.78rem;font-weight:800}
.local-menu{margin-top:30px;border:1px solid var(--line);border-radius:26px;overflow:hidden;background:var(--white)}
.local-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;background:var(--card);font-weight:900}
.menu-item-local{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 22px;border-top:1px solid var(--line)}
.menu-item-name{font-weight:900;font-size:1.08rem}.menu-item-local p{margin:5px 0 0;color:#6b675e;font-size:.92rem}
.menu-item-local>strong{white-space:nowrap;font-size:1rem}
@media(max-width:900px){.local-gallery,.local-menu-gallery{grid-template-columns:1fr 1fr}.local-menu-head{align-items:flex-start;flex-direction:column}}
@media(max-width:520px){.local-gallery,.local-menu-gallery{grid-template-columns:1fr}.menu-item-local{align-items:flex-start;flex-direction:column;gap:8px}}
</style>`);
}

await fs.writeFile(indexPath, out, "utf8");
console.log(JSON.stringify({instagram_images:igFiles.length, menu_images:menuFiles.length, menu_items:usableItems.length}, null, 2));
