// Copiar un texto al portapapeles desde un botón (scripts del navegador): enlaces para compartir (#45) y
// el correo del proyecto (#140). Devuelve si se pudo.

/** Copia con el método anterior, para navegadores que no permiten navigator.clipboard en la página. */
function copiarConSeleccion(texto) {
  const campo = document.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  campo.style.position = "fixed";
  campo.style.opacity = "0";
  document.body.append(campo);
  campo.select();
  const copiado = document.execCommand("copy");
  campo.remove();
  return copiado;
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return copiarConSeleccion(texto);
  }
}
