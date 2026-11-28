// Datos del formulario de contacto (#140) que necesitan la plantilla y su script. Los nombres de los
// campos y los motivos de error deben coincidir con los del Worker (contacto/formulario.js); una prueba
// lo comprueba (pruebas/unidad/formulario.test.js).

export const CAMPOS = {
  mensaje: "mensaje",
  pagina: "pagina",
  correo: "correo",
  asunto: "asunto",
  /** Campo trampa: oculto para las personas; si llega con algo, lo completó un robot. */
  trampa: "sitio_web",
  turnstile: "cf-turnstile-response",
};

/** Largo máximo de cada campo, en caracteres, igual que en el Worker. */
export const LIMITES = { mensaje: 5000, pagina: 300, correo: 254 };

/** Motivo de error que devuelve el Worker → texto de contenido/interaccion.json (contacto). */
export const AVISOS_DE_ERROR = { mensaje: "errorMensaje", correo: "errorCorreo", verificacion: "errorVerificacion" };

/** Script de Cloudflare Turnstile, la verificación contra robots. Solo se carga en la página de contacto. */
export const scriptTurnstile = "https://challenges.cloudflare.com/turnstile/v0/api.js";
/** Clave de prueba de Turnstile, que siempre aprueba: para desarrollo y vistas previas. */
export const CLAVE_PRUEBA_TURNSTILE = "1x00000000000000000000AA";

/**
 * Clave pública del sitio en Turnstile. Va en la variable PUBLIC_TURNSTILE_CLAVE_SITIO del proyecto de
 * Cloudflare Pages (contacto/README.md); no es secreta, se ve en la página. Sin ella, la de prueba.
 */
export const claveTurnstile = (env) => env?.PUBLIC_TURNSTILE_CLAVE_SITIO || CLAVE_PRUEBA_TURNSTILE;
