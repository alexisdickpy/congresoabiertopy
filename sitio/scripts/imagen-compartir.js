// Genera public/compartir.png, la imagen general de la vista previa al compartir (1200 × 630), en cada
// compilación (#126): así sigue al logo y a los colores sin que nadie tenga que acordarse de rehacerla.
// - El símbolo es el de public/favicon.svg (sin su fondo), ampliado.
// - Los colores son los del modo oscuro de src/estilos/tokens.css, el predeterminado del sitio.
// - La tipografía es Inter (scripts/fuente-inter.js). Provisional hasta el diseño de la Fase 4 (#14).
// public/compartir.png no se sube al repositorio. Las páginas la enlazan con una versión según su
// contenido (lib/seo.js, versionar), para que WhatsApp y otras aplicaciones no muestren una vieja.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FUENTE, usarInter } from "./fuente-inter.js";

usarInter(import.meta.url);

const { default: sharp } = await import("sharp");
const { sitio, imagenCompartir } = await import("../src/lib/rutas.js");
const { textos } = await import("../src/lib/contenido.js");

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = readFileSync(resolve(raiz, "src", "estilos", "tokens.css"), "utf-8");
const oscuro = tokens.slice(tokens.indexOf(':root:not([data-modo="claro"])'));
const token = (nombre) => oscuro.match(new RegExp(`--${nombre}:\\s*([^;]+);`))[1].trim();

// El dibujo del favicon (cuadro de 32 × 32), sin el rectángulo de fondo.
const favicon = readFileSync(resolve(raiz, "public", "favicon.svg"), "utf-8");
const simbolo = favicon
  .replace(/^[\s\S]*?<svg[^>]*>/, "")
  .replace(/<\/svg>[\s\S]*$/, "")
  .replace(/<rect[^>]*\/>/g, "")
  .trim();

const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const W = 1200;
const H = 630;
const x = 96;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${token("color-fondo")}"/>
  <rect y="${H - 12}" width="${W}" height="12" fill="${token("color-acento")}"/>
  <g transform="translate(${x - 44} 70) scale(8)">${simbolo}</g>
  <text x="${x}" y="400" fill="${token("color-texto")}" font-family="${FUENTE}" font-size="76" font-weight="700">${escapar(textos.general.sitio.nombre)}</text>
  <text x="${x}" y="468" fill="${token("color-texto-suave")}" font-family="${FUENTE}" font-size="30">Leyes, votaciones y legisladores del Congreso Nacional del Paraguay</text>
  <text x="${x}" y="548" fill="${token("color-acento")}" font-family="${FUENTE}" font-size="30" font-weight="700">${new URL(sitio).host}</text>
</svg>`;

const destino = resolve(raiz, "public", imagenCompartir().slice(1));
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(destino);
console.log(`Imagen para compartir -> ${destino}`);
