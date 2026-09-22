#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "/tmp/rashfa-harvester/node_modules/playwright/index.mjs";

const target = process.argv[2];
if (!target) throw new Error("Target checkout path is required.");

const root = path.resolve(target, "rashfa-wa-khubza-live");
const assetsDir = path.join(root, "assets");
const instagramDir = path.join(assetsDir, "instagram");
const menuDir = path.join(assetsDir, "menu");
const dataDir = path.join(root, "data");
const manifestPath = path.join(dataDir, "rashfa-menu-reconciliation.json");

await fs.mkdir(instagramDir, { recursive: true });
await fs.mkdir(menuDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

const manifest = {
  restaurant: "رشفة وخبزة",
  city: "صحار",
  street: "شارع كشمير",
  instagram: "https://www.instagram.com/rashfeh_khubze/",
  talabat_directory: "https://www.talabat.com/oman/restaurants/2601/sohar-sanaiyah?page=22",
  harvested_at: new Date().toISOString(),
  policy: {
    only_exact_restaurant_sources: true,
    never_invent_menu_items: true,
    never_use_unrelated_images: true,
    local_assets_only_when_downloaded_from_verified_public_source: true
  },
  instagram: { status: "not_extracted", media: [] },
  talabat: { status: "not_extracted", restaurant_url: null, categories: [], items: [] },
  local_assets: { instagram: [], menu: [] }
};

function clean(s) {
  return String(s || "").replace(/\\s+/g, " ").trim();
}

function safeExt(contentType, url) {
  const type = (contentType || "").split(";")[0].toLowerCase();
  if (type === "image/jpeg") return ".jpg";
  if (type === "image/png") return ".png";
  if (type === "image/webp") return ".webp";
  if (type === "image/avif") return ".avif";
  if (type === "image/gif") return ".gif";
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if (/^\\.(jpe?g|png|webp|avif|gif)$/.test(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  } catch {}
  return ".bin";
}

function idFor(url) {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

async function downloadImage(request, url, dir, prefix) {
  if (!/^https?:\\/\\//i.test(url)) return null;
  try {
    const response = await request.get(url, { timeout: 30000, failOnStatusCode: false });
    if (!response.ok()) return null;
    const type = response.headers()["content-type"] || "";
    if (!type.toLowerCase().startsWith("image/")) return null;
    const body = await response.body();
    if (body.length < 4000 || body.length > 12_000_000) return null;
    const ext = safeExt(type, url);
    const file = `${prefix}-${idFor(url)}${ext}`;
    await fs.writeFile(path.join(dir, file), body);
    return { file: `assets/${path.basename(dir)}/${file}`, source_url: url, content_type: type, bytes: body.length };
  } catch {
    return null;
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: "ar-OM",
  viewport: { width: 1440, height: 1000 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36"
});
const request = await context.request;

try {
  const ig = await context.newPage();
  try {
    await ig.goto(manifest.instagram, { waitUntil: "domcontentloaded", timeout: 60000 });
    await ig.waitForTimeout(7000);
    for (let i = 0; i < 4; i++) {
      await ig.mouse.wheel(0, 1800);
      await ig.waitForTimeout(1200);
    }

    const mediaUrls = await ig.evaluate(() => {
      const out = new Set();
      for (const el of document.querySelectorAll("img")) {
        const src = el.currentSrc || el.src;
        if (src) out.add(src);
        const srcset = el.getAttribute("srcset") || "";
        for (const part of srcset.split(",")) {
          const u = part.trim().split(/\\s+/)[0];
          if (u) out.add(u);
        }
      }
      for (const meta of document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')) {
        if (meta.content) out.add(meta.content);
      }
      return [...out];
    });

    const verified = [];
    for (const url of mediaUrls.slice(0, 40)) {
      const saved = await downloadImage(request, url, instagramDir, "ig");
      if (saved) verified.push(saved);
      if (verified.length >= 24) break;
    }

    manifest.instagram.status = verified.length ? "extracted" : "blocked_or_no_media";
    manifest.instagram.media = verified;
    manifest.local_assets.instagram = verified.map(x => x.file);
  } catch (error) {
    manifest.instagram.status = "blocked_or_error";
    manifest.instagram.error = clean(error.message).slice(0, 300);
  } finally {
    await ig.close();
  }

  const talabat = await context.newPage();
  try {
    const directory = manifest.talabat_directory;
    await talabat.goto(directory, { waitUntil: "domcontentloaded", timeout: 60000 });
    await talabat.waitForTimeout(5000);

    let restaurantUrl = null;
    const link = talabat.locator("a").filter({ hasText: /Rashfa\\s+wa\\s+Khobza/i }).first();
    if (await link.count()) {
      restaurantUrl = await link.getAttribute("href");
      if (restaurantUrl && restaurantUrl.startsWith("/")) restaurantUrl = new URL(restaurantUrl, directory).href;
      if (restaurantUrl) {
        await link.click({ timeout: 15000 }).catch(() => {});
        await talabat.waitForTimeout(5000);
      }
    }

    if (!restaurantUrl) {
      const hrefs = await talabat.locator("a").evaluateAll(as =>
        as.map(a => ({ href: a.href, text: (a.innerText || "").trim() }))
          .filter(x => /Rashfa\\s+wa\\s+Khobza/i.test(x.text) && x.href)
      );
      restaurantUrl = hrefs[0]?.href || null;
    }

    if (restaurantUrl) {
      manifest.talabat.restaurant_url = restaurantUrl;
    }

    const bodyText = clean(await talabat.locator("body").innerText());
    const categoryMatches = [...bodyText.matchAll(/(?:Pies|Beverages|Pastries|Coffee|Breakfast|Bakery|Arabic|Juices|Sandwiches|Pizza|Snacks)/gi)]
      .map(m => m[0])
      .filter((v, i, a) => a.findIndex(x => x.toLowerCase() === v.toLowerCase()) === i);
    manifest.talabat.categories = categoryMatches;

    if (restaurantUrl) {
      const cards = await talabat.locator("body *").evaluateAll(els => {
        const seen = new Set();
        const rows = [];
        for (const el of els) {
          const text = (el.innerText || "").replace(/\\s+/g, " ").trim();
          if (!text || text.length < 4 || text.length > 700) continue;
          if (!/(?:OMR|\\b(?:0|[1-9]\\d{0,2})\\.\\d{1,3})/.test(text)) continue;
          const cls = String(el.className || "");
          const id = String(el.id || "");
          if (!/(item|product|menu|card|dish|meal|food)/i.test(cls + " " + id) && el.children.length < 1) continue;
          const key = text.slice(0, 500);
          if (seen.has(key)) continue;
          seen.add(key);
          const price = (text.match(/(?:OMR\\s*)?\\d{1,3}\\.\\d{1,3}/) || [])[0] || null;
          const lines = text.split(/\\n+/).map(x => x.trim()).filter(Boolean);
          rows.push({ text, price, lines: lines.slice(0, 6) });
        }
        return rows.slice(0, 300);
      });

      const imageUrls = await talabat.locator("img").evaluateAll(imgs =>
        imgs.map(i => ({ src: i.currentSrc || i.src, alt: i.alt || "" }))
          .filter(x => x.src && /^https?:/i.test(x.src))
      );

      const menuImages = [];
      for (const item of imageUrls.slice(0, 80)) {
        const saved = await downloadImage(request, item.src, menuDir, "menu");
        if (saved) menuImages.push({ ...saved, alt: clean(item.alt) });
        if (menuImages.length >= 80) break;
      }

      manifest.talabat.items = cards.map((x, i) => ({
        source_text: x.text,
        price_omr: x.price,
        image: menuImages[i]?.file || null
      }));
      manifest.talabat.status = manifest.talabat.items.length ? "extracted" : "restaurant_page_found_but_items_not_extractable";
      manifest.local_assets.menu = menuImages.map(x => x.file);
    } else {
      manifest.talabat.status = "restaurant_link_not_found_in_public_directory";
    }
  } catch (error) {
    manifest.talabat.status = "blocked_or_error";
    manifest.talabat.error = clean(error.message).slice(0, 300);
  } finally {
    await talabat.close();
  }
} finally {
  await context.close();
  await browser.close();
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\\n", "utf8");

console.log(JSON.stringify({
  instagram_status: manifest.instagram.status,
  instagram_media: manifest.instagram.media.length,
  talabat_status: manifest.talabat.status,
  talabat_items: manifest.talabat.items.length,
  local_instagram_assets: manifest.local_assets.instagram.length,
  local_menu_assets: manifest.local_assets.menu.length
}, null, 2));
