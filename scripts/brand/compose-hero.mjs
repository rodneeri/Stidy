// Composite a crisp vector wordmark/glyph/tagline over the AI-generated
// background to produce the README hero. Output is a verifiable PNG.
import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const W = 1344, H = 470;

// Banner crop from the 1344x768 AI background (keeps the teal bloom, trims edges).
const bg = await sharp(resolve(root, "docs/brand/hero-bg.png"))
  .extract({ left: 0, top: 150, width: 1344, height: 470 })
  .toBuffer();

const teal = "#2dd4bf";
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#1fb6a6"/>
      <stop offset="1" stop-color="#5eead4"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- ascending bar-chart glyph -->
  <g transform="translate(132,150)" filter="url(#glow)">
    <rect x="0"  y="64" width="16" height="36"  rx="4" fill="url(#bar)" opacity="0.55"/>
    <rect x="26" y="44" width="16" height="56"  rx="4" fill="url(#bar)" opacity="0.75"/>
    <rect x="52" y="22" width="16" height="78"  rx="4" fill="url(#bar)" opacity="0.9"/>
    <rect x="78" y="0"  width="16" height="100" rx="4" fill="url(#bar)"/>
  </g>

  <!-- eyebrow -->
  <text x="248" y="150" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-size="20" letter-spacing="6" font-weight="600" fill="${teal}" opacity="0.85">
    PERSONAL ACADEMIC OPERATING SYSTEM
  </text>

  <!-- wordmark -->
  <text x="246" y="252" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-size="120" font-weight="800" letter-spacing="1" fill="#f6f8f9">STiDY</text>
  <!-- terminal-cursor accent -->
  <rect x="586" y="158" width="22" height="96" rx="5" fill="${teal}" filter="url(#glow)"/>

  <!-- tagline -->
  <text x="250" y="312" font-family="'Segoe UI','Helvetica Neue',Arial,sans-serif"
        font-size="26" letter-spacing="3" font-weight="500" fill="#aab6bc">
    Your academic command center.
  </text>
</svg>`);

await sharp(bg)
  .composite([{ input: overlay, top: 0, left: 0 }])
  .png()
  .toFile(resolve(root, "docs/brand/hero.png"));

console.log("OK wrote docs/brand/hero.png");
