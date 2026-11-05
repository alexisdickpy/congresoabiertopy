// Tipografía de las imágenes para compartir: Inter, del paquete @expo-google-fonts/inter, para que las
// imágenes salgan iguales en cualquier computadora y en el servidor de compilación. sharp dibuja el texto
// con la tipografía que le indica fontconfig, que lee la variable FONTCONFIG_FILE al iniciar el proceso:
// por eso el script que dibuja se vuelve a ejecutar en un proceso aparte que solo ve esa tipografía.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fuentes = resolve(raiz, "node_modules", "@expo-google-fonts", "inter");
const configuracion = join(tmpdir(), "observatorio-legislativo-fuentes", "fonts.conf");

/** Nombre de la tipografía para los dibujos SVG. */
export const FUENTE = "Inter";

/**
 * Llamar al principio del script que dibuja, con su import.meta.url. Si el proceso todavía no ve solo
 * Inter, vuelve a ejecutar el script en un proceso que sí, y termina con su resultado.
 */
export function usarInter(urlScript) {
  if (process.env.FONTCONFIG_FILE === configuracion) return;
  const carpeta = (ruta) => `<dir>${ruta.replace(/\\/g, "/")}</dir>`;
  mkdirSync(dirname(configuracion), { recursive: true });
  writeFileSync(
    configuracion,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>${carpeta(join(fuentes, "400Regular"))}${carpeta(join(fuentes, "700Bold"))}` +
      `<cachedir>${join(dirname(configuracion), "cache").replace(/\\/g, "/")}</cachedir></fontconfig>\n`,
  );
  const hijo = spawnSync(process.execPath, [fileURLToPath(urlScript)], {
    stdio: "inherit",
    // Un hilo de libuv por procesador, para dibujar varias imágenes a la vez.
    env: { ...process.env, FONTCONFIG_FILE: configuracion, UV_THREADPOOL_SIZE: String(Math.max(4, availableParallelism())) },
  });
  process.exit(hijo.status ?? 1);
}
