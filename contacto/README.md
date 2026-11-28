# Formulario de contacto

Programa que recibe el formulario de [Contacto](https://congresoabiertopy.com/contacto/) y lo manda por correo al proyecto (#140). Corre en Cloudflare Workers, en la dirección `congresoabiertopy.com/api/contacto` del mismo dominio que el sitio, y envía con Cloudflare Email Routing. **No guarda nada**: el mensaje solo viaja por correo.

- [`formulario.js`](formulario.js): valida los campos, comprueba la verificación contra robots (Cloudflare Turnstile) y arma el correo.
- [`worker.js`](worker.js): conecta esa lógica con el envío de Email Routing.
- El formulario está en [`sitio/src/components/FormularioContacto.astro`](../sitio/src/components/FormularioContacto.astro); los nombres de los campos deben coincidir con los de `formulario.js` (lo comprueba `sitio/pruebas/unidad/formulario.test.js`).

## Por qué un Worker aparte

Las Pages Functions del proyecto de Cloudflare Pages no admiten el enlace `send_email` de Email Routing, que sí funciona en un Worker. Este Worker se despliega igual que el del bot (`.github/workflows/contacto.yml`) y responde en una ruta del mismo dominio, así que el formulario no depende de otra dirección.

## Qué hace con cada envío

1. Rechaza lo que no sea un envío desde el propio sitio, lo que pase de 32 KB y un mensaje vacío o de más de 5.000 caracteres.
2. Si el campo trampa (oculto para las personas) llega completo, responde como si se hubiera enviado y no manda nada.
3. Pregunta a Cloudflare si la verificación de Turnstile es válida. No le envía la dirección IP del visitante.
4. Manda el correo desde `formulario@congresoabiertopy.com` a la casilla verificada del proyecto (`CORREO_DESTINO`). Si la persona dejó su correo, va como "Responder a", así que basta con contestar el mensaje.

Motivos de error que devuelve: `metodo`, `origen`, `tamano`, `mensaje`, `correo`, `verificacion`, `envio`.

## Puesta en marcha

Usa el mismo token de Cloudflare (`CLOUDFLARE_API_TOKEN`) y la misma cuenta (`CLOUDFLARE_ACCOUNT_ID`) que el bot.

1. **Crear la verificación contra robots.** En el panel de Cloudflare, menú *Turnstile* → *Add widget*. Nombre: `Congreso Abierto`. Hostname: `congresoabiertopy.com`. Widget mode: *Managed*. Pre-clearance: *No*. Crear. Cloudflare muestra dos claves: la **Site Key** (pública) y la **Secret Key** (secreta).
2. **Clave pública en el sitio.** En *Workers & Pages* → proyecto del sitio → *Settings* → *Variables and Secrets* → *Add*: tipo *Text*, nombre `PUBLIC_TURNSTILE_CLAVE_SITIO`, valor la Site Key, para *Production*. Guardar. Se usa en la próxima compilación del sitio.
3. **Secretos en GitHub.** En el repositorio, *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:

| Secreto | Contenido |
|---|---|
| `TURNSTILE_SECRETO` | La Secret Key de Turnstile |
| `CORREO_DESTINO` | La casilla verificada en Email Routing a la que hoy llega `contacto@congresoabiertopy.com` (*Email* → *Email Routing* → *Destination addresses*) |

4. **Desplegar.** En la pestaña *Actions*, flujo "Despliegue del formulario de contacto" → *Run workflow*. Después se despliega solo cada vez que cambia `contacto/` en `main`.
5. **Probar.** Enviar un mensaje desde la página de Contacto y comprobar que llega.

Si el despliegue falla con un error de permisos sobre la ruta, el token de Cloudflare necesita el permiso *Zone → Workers Routes → Edit* para la zona `congresoabiertopy.com` (*My Profile* → *API Tokens* → editar el token).

Sin la clave pública (paso 2), el sitio usa la clave de prueba de Turnstile, que siempre aprueba; el Worker la rechaza con la clave secreta real, así que el formulario muestra el error y el correo del proyecto para escribir directamente.

## Pruebas

```bash
cd contacto && npm test
```
