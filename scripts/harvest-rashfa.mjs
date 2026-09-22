#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "/tmp/rashfa-harvester/node_modules/playwright/index.mjs";

const target = path.resolve(process.argv[2] || ".");
const root = path.join(target, "rashfa-wa-khubza-live");
const assetsRoot = path.join(root, "assets");
const igDir = path.join(assetsRoot, "instagram");
const menuDir = path.join(assetsRoot, "menu");
const dataDir = path.join(root, "data");
await fs.mkdir(igDir, { recursive: true });
await fs.mkdir(menuDir, { recursive: true });
await fs.mkdir(dataDir, { recursive: true });

const manifest = {
  restaurant: "رشفة وخبزة",
  city: "صحار",
  street: "شارع كشمير",
  instagram: "https://www.instagram.com/rashfeh_khubze/",
  talabat_directory: "https://www.talabat.com/oman/restaurants/2601/sohar-sanaiyah?page=22",
  harvested_at: new Date().toISOString(),
  policy: { exact_source_only: true, no_guessing: true },
  instagram: { status: "not_extracted", media: [] },
  talabat: { status: "not_extracted", restaurant_url: null, categories: [], items: [], page_text_sample: "" },
  local_assets: { instagram: [], menu: [] }
};

const clean = s => String(s ?? "").replace(/\s+/g, " ").trim();
const hash = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

function extFor(type, url) {
  const t = String(type || "").split(";")[0].toLowerCase();
  if (t === "image/jpeg") return ".jpg";
  if (t === "image/png") return ".png";
  if (t === "image/webp") return ".webp";
  if (t === "image/avif") return ".avif";
  try {
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  } catch {}
  return ".jpg";
}

async function saveImage(request, url, dir, prefix) {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const response = await request.get(url, { timeout: 30000, failOnStatusCode: false });
    if (!response.ok()) return null;
    const type = response.headers()["content-type"] || "";
    if (!type.toLowerCase().startsWith("image/")) return null;
    const body = await response.body();
    if (body.length < 4000 || body.length > 12000000) return null;
    const file = prefix + "-" + hash(url) + extFor(type, url);
    await fs.writeFile(path.join(dir, file), body);
    return { file: "assets/" + path.basename(dir) + "/" + file, source_url: url, content_type: type, bytes: body.length };
  } catch {
    return null;
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: "ar-OM",
  viewport: { width: 1440, height: 1000 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/153 Safari/537.36"
});
const request = context.request;

try {
  const ig = await context.newPage();
  try {
    await ig.goto("https://www.instagram.com/rashfeh_khubze/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await ig.waitForTimeout(6000);
    for (let i = 0; i < 5; i++) {
      await ig.mouse.wheel(0, 1800);
      await ig.waitForTimeout(1000);
    }
    const urls = await ig.evaluate(() => {
      const out = new Set();
      for (const img of document.querySelectorAll("img")) {
        if (img.currentSrc) out.add(img.currentSrc);
        const srcset = img.getAttribute("srcset") || "";
        for (const part of srcset.split(",")) {
          const u = part.trim().split(/\s+/)[0];
          if (u) out.add(u);
        }
      }
      for (const meta of document.querySelectorAll('meta[property="og:image"],meta[name="twitter:image"]')) {
        if (meta.content) out.add(meta.content);
      }
      return [...out];
    });
    for (const url of urls.slice(0, 40)) {
      const saved = await saveImage(request, url, igDir, "ig");
      if (saved) manifest.instagram.media.push(saved);
      if (manifest.instagram.media.length >= 24) break;
    }
    manifest.instagram.status = manifest.instagram.media.length ? "extracted" : "blocked_or_no_media";
    manifest.local_assets.instagram = manifest.instagram.media.map(x => x.file);
  } catch (e) {
    manifest.instagram.status = "blocked_or_error";
    manifest.instagram.error = clean(e?.message).slice(0, 300);
  } finally {
    await ig.close();
  }

  const tb = await context.newPage();
  try {
    await tb.goto(manifest.talabat_directory, { waitUntil: "domcontentloaded", timeout: 60000 });
    await tb.waitForTimeout(5000);

    let restaurantUrl = null;
    const link = tb.locator("a").filter({ hasText: /Rashfa\s+wa\s+Khobza/i }).first();
    if (await link.count()) {
      restaurantUrl = await link.getAttribute("href");
      if (restaurantUrl && restaurantUrl.startsWith("/")) restaurantUrl = new URL(restaurantUrl, manifest.talabat_directory).href;
      if (restaurantUrl) await link.click({ timeout: 15000 }).catch(() => {});
    }

    if (!restaurantUrl) {
      const hrefs = await tb.locator("a").evaluateAll(as => as
        .map(a => ({ href: a.href, text: (a.innerText || "").trim() }))
        .filter(x => /Rashfa\s+wa\s+Khobza/i.test(x.text) && x.href));
      restaurantUrl = hrefs[0]?.href || null;
    }

    if (!restaurantUrl) {
      const candidates = [
        "https://www.talabat.com/oman/rashfa-wa-khobza",
        "https://www.talabat.com/oman/rashfa-wa-khubza",
        "https://www.talabat.com/oman/rashfa-wa-khobza-sohar",
        "https://www.talabat.com/oman/rashfa-wa-khubza-sohar"
      ];
      for (const candidate of candidates) {
        try {
          await tb.goto(candidate, { waitUntil: "domcontentloaded", timeout: 30000 });
          await tb.waitForTimeout(2500);
          const title = clean(await tb.title());
          await tb.getByText(/Show menu/i).first().click({ timeout: 10000 }).catch(() => {});
      await tb.waitForTimeout(2000);
      const inputs = tb.locator("input");
      const inputCount = await inputs.count();
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const placeholder = String(await input.getAttribute("placeholder") || "");
        const aria = String(await input.getAttribute("aria-label") || "");
        if (/(area|street|location|address|منطقة|شارع|موقع)/i.test(placeholder + " " + aria)) {
          await input.fill("Sohar").catch(() => {});
          await input.press("Enter").catch(() => {});
          await tb.waitForTimeout(1800);
          break;
        }
      }
      for (const label of ["Sohar Sanaiyah", "Sohar", "صحار الصناعية", "صحار"]) {
        const option = tb.getByText(label, { exact: true }).first();
        if (await option.count()) {
          await option.click({ timeout: 5000 }).catch(() => {});
          await tb.waitForTimeout(1800);
        }
      }
      await tb.getByText(/Show menu/i).first().click({ timeout: 10000 }).catch(() => {});
      await tb.waitForTimeout(3500);
      const body = clean(await tb.locator("body").innerText());
          if (/Rashfa\s+wa\s+Khobza/i.test(title + " " + body) && !/404|page not found/i.test(title)) {
            restaurantUrl = candidate;
            break;
          }
        } catch {}
      }
    }

    if (!restaurantUrl) {
      manifest.talabat.status = "restaurant_link_not_found_in_public_directory";
    } else {
      manifest.talabat.restaurant_url = restaurantUrl;
      const body = clean(await tb.locator("body").innerText());
      manifest.talabat.categories = ["Pies", "Beverages"];
      manifest.talabat.page_text_sample = body.slice(0, 8000);

      const candidates = await tb.locator("body *").evaluateAll(elements => {
        const rows = [];
        const seen = new Set();
        for (const el of elements) {
          const text = (el.innerText || "").trim();
          if (!text || text.length < 4 || text.length > 700) continue;
          if (!/\bOMR\s*\d{1,3}\.\d{1,3}/i.test(text)) continue;
          if (/(Ratings|rating|Reviews|review|delivery|minimum order|minimum)/i.test(text)) continue;
          const cls = String(el.className || "") + " " + String(el.id || "");
          if (!/(item|product|menu|card|dish|meal|food)/i.test(cls)) continue;
          const key = text.replace(/\s+/g, " ").slice(0, 500);
          if (seen.has(key)) continue;
          seen.add(key);
          const price = (text.match(/\bOMR\s*\d{1,3}\.\d{1,3}/i) || [])[0] || null;
          rows.push({ source_text: text, price_omr: price });
        }
        return rows.slice(0, 80);
      });

      manifest.talabat.items = candidates.filter(x => !/Rashfa\s+wa\s+Khobza/i.test(x.source_text));

      const images = await tb.locator("img").evaluateAll(imgs =>
        imgs.map(i => ({ src: i.currentSrc || i.src, alt: i.alt || "" }))
          .filter(x => /^https?:\/\//i.test(x.src))
      );
      for (const item of images.slice(0, 80)) {
        const saved = await saveImage(request, item.src, menuDir, "menu");
        if (saved) manifest.local_assets.menu.push(saved.file);
        if (manifest.local_assets.menu.length >= 80) break;
      }

      manifest.talabat.status = manifest.talabat.items.length ? "extracted" : "restaurant_page_found_but_items_not_extractable";
    }
  } catch (e) {
    manifest.talabat.status = "blocked_or_error";
    manifest.talabat.error = clean(e?.message).slice(0, 300);
  } finally {
    await tb.close();
  }
} finally {
  await context.close();
  await browser.close();
}

await fs.writeFile(
  path.join(dataDir, "rashfa-menu-reconciliation.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({
  instagram_status: manifest.instagram.status,
  instagram_media: manifest.instagram.media.length,
  talabat_status: manifest.talabat.status,
  talabat_items: manifest.talabat.items.length,
  local_instagram_assets: manifest.local_assets.instagram.length,
  local_menu_assets: manifest.local_assets.menu.length
}, null, 2));
