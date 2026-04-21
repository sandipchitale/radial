import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    electron({
      main: {
        entry: 'src/radial.ts',
      },
      preload: {
        input: 'src/preload.ts',
      },
      renderer: {},
    }),
  ],
  define: {
    'process.platform': JSON.stringify(process.platform),
  },
  build: {
    emptyOutDir: true,
  },
  clearScreen: false,
})
