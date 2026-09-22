#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const target = path.resolve(process.argv[2] || ".");
const root = path.join(target, "rashfa-wa-khubza-live");
const indexPath = path.join(root, "index.html");
const manifestPath = path.join(root, "data", "rashfa-menu-reconciliation.json");
const escapeHtml = s => String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");

async function dataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === ".webp" ? "image/webp" : ext === ".png" ? "image/png" : ext === ".avif" ? "image/avif" : "image/jpeg";
  const body = await fs.readFile(file);
  return "data:" + mime + ";base64," + body.toString("base64");
}

const html = await fs.readFile(indexPath, "utf8");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const igDir = path.join(root, "assets", "instagram");
const menuDir = path.join(root, "assets", "menu");

if (!Array.isArray(manifest?.instagram?.media) || manifest.instagram.media.length === 0) {
  for (const file of await fs.readdir(igDir)) await fs.rm(path.join(igDir, file), { force: true });
}

const igFiles = (await fs.readdir(igDir)).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0, 6);
const menuFiles = (await fs.readdir(menuDir)).filter(f => /\.(jpe?g|png|webp|avif)$/i.test(f)).sort().slice(0, 8);
let out = html;

if (igFiles.length) {
  const cards = [];
  for (const file of igFiles) {
    cards.push(
      '<figure class="local-photo"><img src="' + await dataUri(path.join(igDir, file)) +
      '" alt="صورة أصلية من حساب رشفة وخبزة الرسمي" loading="lazy"><figcaption>من الحساب الرسمي @rashfeh_khubze</figcaption></figure>'
    );
  }
  const gallery = '<div class="local-gallery" aria-label="معرض الصور الأصلي">' + cards.join("") + "</div>";
  out = out.replace(
    /<div class="instagram-embed">[\s\S]*?<\/div>\s*<div class="instagram-fallback">/,
    gallery + '<div class="instagram-fallback">'
  );
}

const items = Array.isArray(manifest?.talabat?.items) ? manifest.talabat.items : [];
const usableItems = items.filter(x => x && x.price_omr && x.source_text && !/Rashfa\s+wa\s+Khobza/i.test(x.source_text)).slice(0, 60);
const bestSellers = Array.isArray(manifest?.talabat?.best_sellers) ? manifest.talabat.best_sellers.filter(Boolean).slice(0, 12) : [];

if (usableItems.length || bestSellers.length) {
  const sourceItems = usableItems.length
    ? usableItems.map((item, index) => {
        const lines = String(item.source_text).split(/\n+/).map(s => s.trim()).filter(Boolean);
        return {
          name: lines[0] || ("صنف " + (index + 1)),
          description: lines.slice(1).join(" · "),
          price: String(item.price_omr).replace(/^OMR\s*/i, "")
        };
      })
    : bestSellers.map(name => ({
        name,
        description: "ظاهر علنًا ضمن الأصناف الأكثر مبيعًا على طلبات.",
        price: "غير ظاهر علنًا"
      }));

  const cards = sourceItems.map(item =>
    '<article class="menu-item-local"><div><div class="menu-item-name">' +
    escapeHtml(item.name) + '</div>' +
    (item.description ? '<p>' + escapeHtml(item.description) + '</p>' : '') +
    '</div><strong>' + escapeHtml(item.price) + ' ر.ع.</strong></article>'
  ).join("");

  const heading = usableItems.length ? "القائمة المستخرجة من صفحة المطعم" : "الأصناف الظاهرة علنًا";
  const localMenu =
    '<div class="local-menu"><div class="local-menu-head"><span>' + heading +
    '</span><a class="btn secondary" href="https://www.talabat.com/oman/restaurants/2601/sohar-sanaiyah?page=22" target="_blank" rel="noopener noreferrer">طلبات ↗</a></div>' +
    cards + "</div>";

  out = out.replace(
    /<div class="menu-source-grid">[\s\S]*?<\/div>\s*<div class="verified-menu">/,
    localMenu + '<div class="verified-menu">'
  );
}

if (menuFiles.length) {
  const cards = [];
  for (const file of menuFiles) {
    cards.push(
      '<figure class="local-photo"><img src="' + await dataUri(path.join(menuDir, file)) +
      '" alt="صورة من قائمة رشفة وخبزة على طلبات" loading="lazy"><figcaption>صورة من مصدر طلبات</figcaption></figure>'
    );
  }
  const gallery = '<div class="local-menu-gallery" aria-label="صور القائمة من طلبات">' + cards.join("") + "</div>";
  out = out.replace(/<div class="verified-menu">/, gallery + '<div class="verified-menu">');
}

if (igFiles.length || menuFiles.length || usableItems.length || bestSellers.length) {
  out = out.replace(
    "</style>",
    '.local-gallery,.local-menu-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:22px}.local-photo{margin:0;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--white)}.local-photo img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover}.local-photo figcaption{padding:10px 13px;color:#6b675e;font-size:.78rem;font-weight:800}.local-menu{margin-top:30px;border:1px solid var(--line);border-radius:26px;overflow:hidden;background:var(--white)}.local-menu-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;background:var(--card);font-weight:900}.menu-item-local{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px 22px;border-top:1px solid var(--line)}.menu-item-name{font-weight:900;font-size:1.08rem}.menu-item-local p{margin:5px 0 0;color:#6b675e;font-size:.92rem}.menu-item-local>strong{white-space:nowrap;font-size:1rem}@media(max-width:900px){.local-gallery,.local-menu-gallery{grid-template-columns:1fr 1fr}.local-menu-head{align-items:flex-start;flex-direction:column}}@media(max-width:520px){.local-gallery,.local-menu-gallery{grid-template-columns:1fr}.menu-item-local{align-items:flex-start;flex-direction:column;gap:8px}}' +
    "</style>"
  );
}

await fs.writeFile(indexPath, out, "utf8");
console.log(JSON.stringify({
  instagram_images: igFiles.length,
  menu_images: menuFiles.length,
  menu_items: usableItems.length,
  best_sellers: bestSellers.length
}, null, 2));
