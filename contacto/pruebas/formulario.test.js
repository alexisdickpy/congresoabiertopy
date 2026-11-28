// Pruebas del formulario de contacto (#140), con Turnstile y el envío de correo simulados.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { armarCorreo, atender, CAMPOS, ERRORES, LIMITES, textoDelCorreo, validar } from "../formulario.js";

const SITIO = "https://ejemplo.test";
const env = { SITIO, REMITENTE: "formulario@ejemplo.test", CORREO_DESTINO: "destino@ejemplo.test", TURNSTILE_SECRETO: "secreto" };

let enviados;
let verificaciones;
let turnstileValido;
const fetchOriginal = globalThis.fetch;
const enviar = async (remitente, destino, crudo) => enviados.push({ remitente, destino, crudo });

beforeEach(() => {
  enviados = [];
  verificaciones = [];
  turnstileValido = true;
  globalThis.fetch = async (url, opciones) => {
    verificaciones.push({ url, cuerpo: new URLSearchParams(opciones.body.toString()) });
    return Response.json({ success: turnstileValido });
  };
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

const formulario = (campos) => new URLSearchParams({ [CAMPOS.turnstile]: "token", ...campos });
const pedido = (campos, { metodo = "POST", origen = SITIO, cuerpo } = {}) =>
  new Request(`${SITIO}/api/contacto`, {
    method: metodo,
    headers: { "content-type": "application/x-www-form-urlencoded", ...(origen ? { origin: origen } : {}) },
    ...(metodo === "POST" ? { body: cuerpo ?? formulario(campos).toString() } : {}),
  });
const respuesta = async (r) => ({ status: r.status, ...(await r.json()) });

/** Texto del cuerpo de un correo armado, decodificado desde base64. */
const cuerpoDe = (crudo) => Buffer.from(crudo.split("\r\n\r\n")[1].replace(/\s/g, ""), "base64").toString("utf-8");

test("un mensaje válido se verifica con Turnstile y se envía al destino con el correo para responder", async () => {
  const r = await respuesta(await atender(pedido({ mensaje: "Hay un error en la ley 7000.", pagina: `${SITIO}/leyes/7000/`, correo: "persona@correo.test" }), env, enviar));
  assert.deepEqual(r, { status: 200, ok: true });
  assert.equal(verificaciones.length, 1);
  assert.equal(verificaciones[0].cuerpo.get("secret"), "secreto");
  assert.equal(verificaciones[0].cuerpo.get("response"), "token");
  assert.equal(verificaciones[0].cuerpo.has("remoteip"), false, "No se envía la IP del visitante");
  assert.equal(enviados.length, 1);
  const { remitente, destino, crudo } = enviados[0];
  assert.equal(remitente, env.REMITENTE);
  assert.equal(destino, env.CORREO_DESTINO);
  assert.match(crudo, /^Reply-To: <persona@correo\.test>\r$/m);
  const cuerpo = cuerpoDe(crudo);
  assert.ok(cuerpo.includes("Hay un error en la ley 7000."));
  assert.ok(cuerpo.includes(`Página: ${SITIO}/leyes/7000/`));
});

test("sin correo para responder no hay Reply-To y el cuerpo lo indica", async () => {
  await atender(pedido({ mensaje: "Hola" }), env, enviar);
  assert.doesNotMatch(enviados[0].crudo, /Reply-To/);
  assert.ok(cuerpoDe(enviados[0].crudo).includes("Correo para responder: no indicado"));
});

test("el campo trampa responde como enviado pero no verifica ni envía nada", async () => {
  const r = await respuesta(await atender(pedido({ mensaje: "Compre ya", [CAMPOS.trampa]: "https://spam.test" }), env, enviar));
  assert.deepEqual(r, { status: 200, ok: true });
  assert.equal(verificaciones.length, 0);
  assert.equal(enviados.length, 0);
});

test("sin mensaje, con un mensaje demasiado largo o con un correo inválido se rechaza sin enviar", async () => {
  for (const [campos, error] of [
    [{ mensaje: "   " }, ERRORES.mensaje],
    [{ mensaje: "a".repeat(LIMITES.mensaje + 1) }, ERRORES.mensaje],
    [{ mensaje: "Hola", correo: "no-es-un-correo" }, ERRORES.correo],
    [{ mensaje: "Hola", correo: "a@b.test\r\nBcc: otro@x.test" }, ERRORES.correo],
  ]) {
    const r = await respuesta(await atender(pedido(campos), env, enviar));
    assert.equal(r.status, 400);
    assert.equal(r.error, error);
  }
  assert.equal(enviados.length, 0);
});

test("un envío más grande que el límite se rechaza", async () => {
  const r = await respuesta(await atender(pedido(null, { cuerpo: `mensaje=${"a".repeat(LIMITES.envio)}` }), env, enviar));
  assert.equal(r.status, 413);
  assert.equal(r.error, ERRORES.tamano);
  assert.equal(enviados.length, 0);
});

test("si Turnstile no lo valida, o falta la prueba, no se envía", async () => {
  turnstileValido = false;
  let r = await respuesta(await atender(pedido({ mensaje: "Hola" }), env, enviar));
  assert.equal(r.status, 403);
  assert.equal(r.error, ERRORES.verificacion);
  turnstileValido = true;
  r = await respuesta(await atender(pedido(null, { cuerpo: "mensaje=Hola" }), env, enviar));
  assert.equal(r.error, ERRORES.verificacion);
  assert.equal(enviados.length, 0);
});

test("otro método u otro sitio de origen se rechazan", async () => {
  assert.equal((await respuesta(await atender(pedido(null, { metodo: "GET" }), env, enviar))).status, 405);
  const r = await respuesta(await atender(pedido({ mensaje: "Hola" }, { origen: "https://otro.test" }), env, enviar));
  assert.equal(r.status, 403);
  assert.equal(r.error, ERRORES.origen);
  assert.equal(enviados.length, 0);
});

test("si falla el envío del correo, responde con error", async () => {
  const r = await respuesta(
    await atender(pedido({ mensaje: "Hola" }), env, async () => {
      throw new Error("destino no verificado");
    }),
  );
  assert.equal(r.status, 502);
  assert.equal(r.error, ERRORES.envio);
});

test("validar quita los saltos de línea de la página y el asunto, y recorta su largo", () => {
  const datos = new URLSearchParams({ mensaje: "Hola", pagina: "a\r\nb", asunto: `x\ny${"z".repeat(500)}` });
  const { valores } = validar(datos);
  assert.equal(valores.pagina, "a b");
  assert.ok(valores.asunto.startsWith("x y"));
  assert.equal(valores.asunto.length, LIMITES.asunto);
});

test("el correo armado tiene las cabeceras necesarias y el asunto codificado en UTF-8", () => {
  const crudo = armarCorreo({
    remitente: "formulario@ejemplo.test",
    destino: "destino@ejemplo.test",
    valores: { mensaje: "Línea 1\nLínea 2", correo: "", pagina: "", asunto: "Error en la página" },
    fecha: new Date("2026-11-28T12:00:00Z"),
    id: "abc",
  });
  const [cabeceras] = crudo.split("\r\n\r\n");
  assert.match(cabeceras, /^From: Formulario de Congreso Abierto <formulario@ejemplo\.test>$/m);
  assert.match(cabeceras, /^To: <destino@ejemplo\.test>$/m);
  assert.match(cabeceras, /^Message-ID: <abc@ejemplo\.test>$/m);
  assert.match(cabeceras, /^Date: Sat, 28 Nov 2026 12:00:00 GMT$/m);
  const asunto = cabeceras.match(/^Subject: =\?UTF-8\?B\?(.+)\?=$/m)[1];
  assert.equal(Buffer.from(asunto, "base64").toString("utf-8"), "Congreso Abierto: Error en la página");
  assert.equal(cuerpoDe(crudo), textoDelCorreo({ mensaje: "Línea 1\nLínea 2", correo: "", pagina: "" }).replace(/\n/g, "\r\n"));
});
