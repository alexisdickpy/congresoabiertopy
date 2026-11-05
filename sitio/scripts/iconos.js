// Genera los íconos PNG de respaldo a partir de public/favicon.svg (#122):
// public/favicon-32.png (navegadores sin soporte de SVG) y public/apple-touch-icon.png (180 px,
// pantalla de inicio de iOS). No corre en la compilación: ejecutar a mano si cambia el favicon
// (node scripts/iconos.js) y subir los PNG resultantes.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publico = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const svg = readFileSync(resolve(publico, "favicon.svg"));

for (const [nombre, lado] of [
  ["favicon-32.png", 32],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(svg, { density: (72 * lado) / 32 })
    .resize(lado, lado)
    .png()
    .toFile(resolve(publico, nombre));
  console.log(`${nombre}: ${lado} × ${lado}`);
}
