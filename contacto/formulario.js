// Lógica del formulario de contacto (#140): valida lo enviado, comprueba Cloudflare Turnstile y arma el
// correo al proyecto. No guarda nada: el mensaje solo viaja por correo. Separado de worker.js para poder
// probarlo con Node, sin el módulo cloudflare:email (pruebas/formulario.test.js).

/** Nombres de los campos del formulario (sitio/src/components/FormularioContacto.astro). */
export const CAMPOS = {
  mensaje: "mensaje",
  pagina: "pagina",
  correo: "correo",
  asunto: "asunto",
  /** Campo trampa: oculto para las personas; si llega con algo, lo completó un robot. */
  trampa: "sitio_web",
  turnstile: "cf-turnstile-response",
};

/** Largo máximo de cada campo, en caracteres, y del envío completo, en bytes. */
export const LIMITES = { mensaje: 5000, pagina: 300, correo: 254, asunto: 120, envio: 32 * 1024 };

/** Motivos de rechazo que devuelve la función y que el formulario traduce a un aviso. */
export const ERRORES = {
  metodo: "metodo",
  origen: "origen",
  tamano: "tamano",
  mensaje: "mensaje",
  correo: "correo",
  verificacion: "verificacion",
  envio: "envio",
};

const VERIFICAR_TURNSTILE = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const CORREO_VALIDO = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;

/** Texto de un campo sin espacios sobrantes; nunca null. */
const campo = (datos, nombre) => String(datos.get(nombre) ?? "").trim();
/** Sin saltos de línea, para lo que va en una cabecera del correo. */
const enUnaLinea = (texto) => texto.replace(/[\r\n]+/g, " ");

/**
 * Valida los campos del formulario. Devuelve { error } con un motivo de ERRORES, { trampa: true } si
 * lo completó un robot o { valores } con el texto listo para el correo.
 */
export function validar(datos) {
  if (campo(datos, CAMPOS.trampa)) return { trampa: true };
  const mensaje = campo(datos, CAMPOS.mensaje);
  if (!mensaje || mensaje.length > LIMITES.mensaje) return { error: ERRORES.mensaje };
  const correo = campo(datos, CAMPOS.correo);
  if (correo && (correo.length > LIMITES.correo || !CORREO_VALIDO.test(correo))) return { error: ERRORES.correo };
  return {
    valores: {
      mensaje,
      correo,
      pagina: enUnaLinea(campo(datos, CAMPOS.pagina)).slice(0, LIMITES.pagina),
      asunto: enUnaLinea(campo(datos, CAMPOS.asunto)).slice(0, LIMITES.asunto),
    },
  };
}

/** Pregunta a Cloudflare si la prueba de Turnstile es válida. No envía la dirección IP del visitante. */
export async function verificarTurnstile(token, secreto) {
  if (!token || !secreto) return false;
  const respuesta = await fetch(VERIFICAR_TURNSTILE, { method: "POST", body: new URLSearchParams({ secret: secreto, response: token }) });
  if (!respuesta.ok) return false;
  const resultado = await respuesta.json();
  return resultado.success === true;
}

/** Base64 de un texto en UTF-8, en líneas de 76 caracteres como pide el formato de correo. */
function base64(texto) {
  let binario = "";
  for (const byte of new TextEncoder().encode(texto)) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/.{1,76}/g, "$&\r\n").trimEnd();
}

/** Cuerpo del correo: de dónde viene, la página, el correo para responder y el mensaje. */
export function textoDelCorreo({ mensaje, correo, pagina }) {
  return [
    "Mensaje enviado desde el formulario de contacto de Congreso Abierto.",
    "",
    `Página: ${pagina || "no indicada"}`,
    `Correo para responder: ${correo || "no indicado"}`,
    "",
    "Mensaje:",
    mensaje,
    "",
  ].join("\n");
}

/** Correo completo (MIME) en texto, listo para EmailMessage. Si hay correo para responder, va en Reply-To. */
export function armarCorreo({ remitente, destino, valores, fecha = new Date(), id = crypto.randomUUID() }) {
  const dominio = remitente.split("@")[1];
  const asunto = `Congreso Abierto: ${valores.asunto || "mensaje desde el formulario"}`;
  const cabeceras = [
    `From: Formulario de Congreso Abierto <${remitente}>`,
    `To: <${destino}>`,
    ...(valores.correo ? [`Reply-To: <${valores.correo}>`] : []),
    `Subject: =?UTF-8?B?${base64(asunto).replace(/\r\n/g, "")}?=`,
    `Date: ${fecha.toUTCString()}`,
    `Message-ID: <${id}@${dominio}>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ];
  return `${cabeceras.join("\r\n")}\r\n\r\n${base64(textoDelCorreo(valores).replace(/\r?\n/g, "\r\n"))}\r\n`;
}

const json = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const rechazo = (error, status) => json({ ok: false, error }, status);

/**
 * Atiende un envío del formulario. `enviar(remitente, destino, crudo)` manda el correo; worker.js le pasa
 * el envío de Email Routing y las pruebas, uno simulado.
 */
export async function atender(request, env, enviar) {
  if (request.method !== "POST") return rechazo(ERRORES.metodo, 405);
  const origen = request.headers.get("origin");
  if (origen && origen !== env.SITIO) return rechazo(ERRORES.origen, 403);
  const largo = Number(request.headers.get("content-length") ?? 0);
  if (largo > LIMITES.envio) return rechazo(ERRORES.tamano, 413);

  let datos;
  try {
    const cuerpo = await request.text();
    if (new TextEncoder().encode(cuerpo).length > LIMITES.envio) return rechazo(ERRORES.tamano, 413);
    datos = await new Response(cuerpo, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch {
    return rechazo(ERRORES.mensaje, 400);
  }

  const { error, trampa, valores } = validar(datos);
  // Al robot se le responde como si se hubiera enviado, para que no insista; no se manda nada.
  if (trampa) return json({ ok: true });
  if (error) return rechazo(error, 400);
  if (!(await verificarTurnstile(campo(datos, CAMPOS.turnstile), env.TURNSTILE_SECRETO))) return rechazo(ERRORES.verificacion, 403);

  try {
    const crudo = armarCorreo({ remitente: env.REMITENTE, destino: env.CORREO_DESTINO, valores });
    await enviar(env.REMITENTE, env.CORREO_DESTINO, crudo);
  } catch (e) {
    console.error("No se pudo enviar el correo:", e?.message ?? e);
    return rechazo(ERRORES.envio, 502);
  }
  return json({ ok: true });
}
