import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

const API = process.env['VITE_API'] ?? 'http://localhost:3000'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    /**
     * Vite rechaza peticiones cuyo `Host` no reconoce. Un túnel de Cloudflare
     * llega con `Host: algo.trycloudflare.com` y sin esto responde
     * "Blocked request. This host is not allowed."
     */
    allowedHosts: true,

    /**
     * Lo ÚNICO que el navegador necesita de la API es el canal en vivo: todo lo
     * demás pasa por los `load` del servidor, que ya adjuntan el token. Detrás
     * de un túnel `localhost:3000` no existe para el visitante, así que el
     * WebSocket sale al mismo origen y se reenvía aquí.
     *
     * Se reenvía solo esa ruta a propósito. Un proxy de `/_api/*` entero
     * publicaría también la ingesta por el túnel; no sería un agujero (exige
     * clave) pero es superficie que nadie necesita.
     *
     * Esto es del servidor de desarrollo. En producción el reenvío lo hace el
     * reverse proxy de verdad (Caddy, nginx, Cloudflare).
     */
    proxy: {
      '/_api/v1/live': {
        target: API,
        changeOrigin: true,
        ws: true,
        rewrite: (ruta) => ruta.replace(/^\/_api/, ''),
      },
    },
  },
})
