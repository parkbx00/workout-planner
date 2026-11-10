// Regenerates the PNG icons in public/ from scripts/icon.svg. Run: npm run icons
import sharp from 'sharp'
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('./icon.svg', import.meta.url))
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url))

for (const [name, size] of [
  ['pwa-192.png', 192],
  ['pwa-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(out(name))
}
copyFileSync(src, out('favicon.svg'))
