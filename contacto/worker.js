// Worker del formulario de contacto (#140). Responde en congresoabiertopy.com/api/contacto (wrangler.toml)
// y manda cada mensaje por Email Routing al correo del proyecto. La lógica está en formulario.js.
import { EmailMessage } from "cloudflare:email";

import { atender } from "./formulario.js";

export default {
  fetch(request, env) {
    return atender(request, env, (remitente, destino, crudo) => env.CORREO.send(new EmailMessage(remitente, destino, crudo)));
  },
};
