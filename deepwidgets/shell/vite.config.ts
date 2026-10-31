// The widget shell page (`widget_mvp.shell`). Electron main serves dist/ at dsh-app://app/,
// so the URL path /widget/<file> maps to dist/widget/<file>.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/widget/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/widget', emptyOutDir: true, target: 'chrome140' },
})
