const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const iconsDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG simple : carré noir + L blanche (formé par 2 rectangles)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <rect x="128" y="96" width="80" height="320" fill="#ffffff"/>
  <rect x="128" y="352" width="256" height="80" fill="#ffffff"/>
</svg>`;

async function generate() {
  const buf = Buffer.from(svg);
  await sharp(buf).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192x192.png"));
  await sharp(buf).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512x512.png"));
  await sharp(buf).resize(180, 180).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));
  console.log("PWA icons generated: icon-192x192.png, icon-512x512.png, apple-touch-icon.png");
}

generate().catch(console.error);
