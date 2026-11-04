// Índice de búsqueda (#104): Pagefind indexa las páginas compiladas (fichas de leyes y de legisladores) y
// este script le suma, como registros propios, los proyectos de ley del período que no son leyes
// sancionadas, porque no tienen página en el sitio. Cada proyecto lleva su título y su expediente
// oficiales, su estado oficial sin cambios y el enlace a su expediente en SILpy, el mismo de /proyectos/.
// Se ejecuta después de `astro build` (npm run build).
import * as pagefind from "pagefind";

import { periodos } from "../src/lib/datos.js";
import { proyectosDeLey } from "../src/lib/proyectos.js";
import { TIPOS_BUSQUEDA } from "../src/lib/busqueda.js";

const periodo = periodos().find((p) => p.vigente).id;
const proyectos = proyectosDeLey(periodo).filter((p) => !p.ley && p.url);

const { index, errors } = await pagefind.createIndex({ forceLanguage: "es" });
if (!index) throw new Error(`Pagefind no pudo crear el índice: ${errors.join("; ")}`);

const sitio = await index.addDirectory({ path: "dist" });
if (sitio.errors.length) throw new Error(`Pagefind: ${sitio.errors.join("; ")}`);

for (const p of proyectos) {
  const r = await index.addCustomRecord({
    url: p.url,
    content: [p.tituloCompleto, p.expediente].filter(Boolean).join(". "),
    language: "es",
    meta: { title: p.titulo, estado: p.estado ?? "", expediente: p.expediente ?? "" },
    filters: { tipo: [TIPOS_BUSQUEDA.proyecto] },
  });
  if (r.errors.length) throw new Error(`Pagefind, proyecto ${p.id}: ${r.errors.join("; ")}`);
}

const escritura = await index.writeFiles({ outputPath: "dist/pagefind" });
if (escritura.errors.length) throw new Error(`Pagefind: ${escritura.errors.join("; ")}`);
await pagefind.close();
console.log(`Índice de búsqueda: ${sitio.page_count} páginas y ${proyectos.length} proyectos de ley.`);
