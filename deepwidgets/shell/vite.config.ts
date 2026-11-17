// The widget shell page (`widget_mvp.shell`). Electron main serves dist/ at dsh-app://app/,
// so the URL path /widget/<file> maps to dist/widget/<file>.
// The second entry, main.html, is the page of the main widget (`main_widget.widget`).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/widget/',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/widget',
    emptyOutDir: true,
    target: 'chrome140',
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL('index.html', import.meta.url)),
        main: fileURLToPath(new URL('main.html', import.meta.url)),
      },
    },
  },
})
