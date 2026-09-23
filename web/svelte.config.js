import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * `MOELOG_ORIGIN` es la URL pública por la que se entra al panel, p. ej. la que
 * imprime `cloudflared`. SvelteKit compara el `Origin` de cada formulario con
 * su propio origen, y detrás de un túnel no coinciden (el navegador manda
 * `https://…trycloudflare.com` y el servidor se cree `http://localhost:5174`).
 * Sin esto, el login devuelve 403.
 *
 * Se añade a los orígenes de confianza en vez de desactivar la comprobación:
 * apagar el CSRF para una demo es la clase de atajo que después se queda puesto.
 */
const origenPublico = process.env.MOELOG_ORIGIN

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    ...(origenPublico ? { csrf: { trustedOrigins: [origenPublico] } } : {}),
  },
}
