const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const iconsDir = path.join(__dirname, "..", "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");
const sizes = [180, 152, 167, 120]; // iPhone, iPad, iPad Pro, etc.

async function generate() {
  const svg = fs.readFileSync(svgPath);
  for (const size of sizes) {
    await sharp(svg).resize(size, size).png().toFile(path.join(iconsDir, `apple-touch-icon-${size}x${size}.png`));
  }
  await sharp(svg).resize(180, 180).png().toFile(path.join(iconsDir, "apple-touch-icon.png"));
  await sharp(svg).resize(192, 192).png().toFile(path.join(iconsDir, "icon-192x192.png"));
  await sharp(svg).resize(512, 512).png().toFile(path.join(iconsDir, "icon-512x512.png"));
  console.log("Icons generated.");
}

generate().catch(console.error);
