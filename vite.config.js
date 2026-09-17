import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const raiz = import.meta.dirname;

// El portal son tres páginas independientes, no una sola aplicación:
// el portal interno y las dos páginas públicas que usan los clientes.
// Las públicas no cargan React: son HTML y JS a mano, y así se quedan
// (cargan en cualquier celular viejo y no dependen de nada).
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        portal: resolve(raiz, "index.html"),
        denuncia: resolve(raiz, "denuncia.html"),
        cotizar: resolve(raiz, "cotizar-hogar.html"),
      },
    },
  },
  server: { open: false },
});
