import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");
const previewDirectory = path.resolve(
  process.argv[2] ?? process.env.ORBI_PREVIEW_DIR ?? path.join(directory, "preview"),
);
const pdfPath = path.join(directory, "orbi-presentation.pdf");
await mkdir(previewDirectory, { recursive: true });

console.log("Launching Chromium...");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const networkRequests = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (/^(file:|data:|about:)/u.test(url)) await route.continue();
    else {
      networkRequests.push(url);
      await route.abort();
    }
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(pathToFileURL(path.join(directory, "slides.html")).href);
  console.log("Loading local fonts and images...");
  await page.emulateMedia({ media: "print" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('700 60px "Golos Text"', "Орби, самостоятельная задача");
    await document.fonts.load('400 18px "Press Start 2P"', "0123456789");
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });

  const audit = await page.evaluate(() => {
    const slides = [...document.querySelectorAll("section.slide")];
    const issues = [];
    const bounds = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const pages = slides.map((slide, index) => {
      const rect = slide.getBoundingClientRect();
      if (rect.width !== 1920 || rect.height !== 1080) issues.push(`Slide ${index + 1}: wrong size`);
      for (const element of slide.querySelectorAll("[data-fit]")) {
        // Natural-height text blocks can include font ascenders outside the line box.
        // Fixed-height panels and horizontal overflow remain strict layout checks.
        const fixedHeight = element.matches(".scenario, .arch-node, .metric-hero") || Boolean(element.style.height);
        const hasOverflow = element.scrollWidth > element.clientWidth + 3 && !element.matches(".flow-step");
        if ((fixedHeight && element.scrollHeight > element.clientHeight + 3) || hasOverflow) {
          issues.push(`Slide ${index + 1}: overflowing ${element.className} (${element.scrollWidth}×${element.scrollHeight} / ${element.clientWidth}×${element.clientHeight})`);
        }
      }
      const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
      const source = slide.querySelector(".source")?.getBoundingClientRect();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim() || node.parentElement.closest("svg")) continue;
        if (parseFloat(getComputedStyle(node.parentElement).fontSize) < 18) {
          issues.push(`Slide ${index + 1}: text smaller than 18px: ${node.textContent.trim().slice(0, 50)}`);
        }
        if (/[ёЁ]/u.test(node.textContent)) issues.push(`Slide ${index + 1}: forbidden letter in authored text`);
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const box of range.getClientRects()) {
          if (box.left < rect.left - 1 || box.right > rect.right + 1 || box.top < rect.top - 1 || box.bottom > rect.bottom + 1) {
            issues.push(`Slide ${index + 1}: text outside slide: ${node.textContent.trim().slice(0, 50)}`);
          }
          if (!node.parentElement.closest(".footer") && box.bottom > rect.top + 1008) {
            issues.push(`Slide ${index + 1}: text enters the footer area: ${node.textContent.trim().slice(0, 50)}`);
          }
          if (source && !node.parentElement.closest(".footer, .source") && box.bottom > source.top - 8) {
            issues.push(`Slide ${index + 1}: text enters the source area: ${node.textContent.trim().slice(0, 50)}`);
          }
          const container = node.parentElement.closest(".card[data-fit], .arch-node[data-fit], .metric-hero[data-fit], .flow-step[data-fit]");
          if (container) {
            const parent = container.getBoundingClientRect();
            if (box.left < parent.left - 1 || box.right > parent.right + 1 || box.top < parent.top - 1 || box.bottom > parent.bottom + 1) {
              issues.push(`Slide ${index + 1}: text outside its block: ${node.textContent.trim().slice(0, 50)}`);
            }
          }
        }
      }
      const heading = slide.querySelector("h1");
      const headingBounds = bounds(heading);
      let bodyWords = null;
      if (index >= 1 && index <= 11) {
        const body = slide.querySelector(".body").cloneNode(true);
        body.querySelectorAll("svg, figcaption").forEach((element) => element.remove());
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) parts.push(walker.currentNode.textContent);
        bodyWords = parts.join(" ").split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
        if (bodyWords > 65) issues.push(`Slide ${index + 1}: body has ${bodyWords} words (limit 65)`);
        const bodyBounds = slide.querySelector(".body").getBoundingClientRect();
        if (Math.abs(bodyBounds.top - rect.top - 310) > 1) issues.push(`Slide ${index + 1}: body is not aligned`);
      }
      return {
        number: index + 1,
        bodyWords,
        title: heading.innerText.trim().replace(/\s+/gu, " "),
        width: rect.width,
        height: rect.height,
        heading: { x: headingBounds.x - rect.x, y: headingBounds.y - rect.y },
      };
    });
    if (slides.length !== 18) issues.push("Expected 12 main slides, an appendix divider and A1–A5");
    const contentHeadings = pages.filter((_, index) => index !== 0 && index !== 12).map((item) => JSON.stringify(item.heading));
    if (new Set(contentHeadings).size !== 1) issues.push("Content headings are not aligned");
    if (!document.fonts.check('700 60px "Golos Text"', "Орби")) issues.push("Golos Text did not load");
    if (!document.fonts.check('400 18px "Press Start 2P"', "0123")) issues.push("Pixel font did not load");
    const brokenImages = [...document.images].filter((image) => !image.complete || image.naturalWidth === 0);
    if (brokenImages.length) issues.push("Some images did not load");
    return { pages, issues, imageCount: document.images.length, linkCount: document.querySelectorAll("a[href]").length };
  });

  // Chromium reports the actual fonts used for glyphs, not only the CSS family.
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root: dom } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: dom.nodeId, selector: "#s02 h1" });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
  if (!fonts.length || fonts.some((font) => !font.isCustomFont || !/golos/iu.test(font.familyName))) {
    audit.issues.push("Heading uses a fallback font");
  }
  audit.renderedFonts = fonts;
  const { nodeId: pixelNodeId } = await cdp.send("DOM.querySelector", { nodeId: dom.nodeId, selector: ".page-no" });
  const { fonts: pixelFonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: pixelNodeId });
  audit.renderedPixelFonts = pixelFonts;
  if (!pixelFonts.length || pixelFonts.some((font) => !font.isCustomFont || !/press start/iu.test(font.familyName))) {
    audit.issues.push("Pixel labels use a fallback font");
  }
  audit.networkRequests = networkRequests;
  audit.pageErrors = pageErrors;
  audit.issues.push(...pageErrors, ...networkRequests.map((url) => `External request: ${url}`));

  await writeFile(path.join(previewDirectory, "build-report.json"), `${JSON.stringify(audit, null, 2)}\n`);
  console.log("Rendering PDF and PNG previews...");
  await page.pdf({
    path: pdfPath,
    width: "1920px",
    height: "1080px",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: false,
    tagged: true,
    outline: true,
  });
  const slides = page.locator("section.slide");
  for (let index = 0; index < audit.pages.length; index += 1) {
    await slides.nth(index).screenshot({
      path: path.join(previewDirectory, `slide-${String(index + 1).padStart(2, "0")}.png`),
      animations: "disabled",
    });
  }
  const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  await writeFile(path.join(previewDirectory, "index.html"), `<!doctype html><html lang="ru"><meta charset="utf-8"><title>Орби — превью</title><style>body{font-family:Arial,sans-serif;background:#f7f8fa;color:#25252b;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:28px}img{width:100%;border-radius:8px}a{color:inherit;text-decoration:none}p{line-height:1.4}</style><h1>Орби · 12 основных слайдов + приложения</h1><main>${audit.pages.map((item, index) => `<a href="slide-${String(index + 1).padStart(2, "0")}.png"><img src="slide-${String(index + 1).padStart(2, "0")}.png" alt="${escapeHtml(item.title)}"><p>${index + 1}. ${escapeHtml(item.title)}</p></a>`).join("")}</main></html>\n`);
  if (audit.issues.length) throw new Error(audit.issues.join("\n"));
  console.log(`Built ${audit.pages.length} slides. Layout/font/resource checks: passed.`);
  console.log(`PDF: ${pdfPath}`);
  console.log(`PNG: ${previewDirectory}`);
} finally {
  await browser.close();
}
