import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { fileURLToPath } from 'node:url'

const quasarVariables = fileURLToPath(new URL('./src/css/quasar.variables.scss', import.meta.url))

export default defineConfig({
  plugins: [
    vue({
      template: { transformAssetUrls },
    }),
    quasar({ sassVariables: quasarVariables }),
  ],
  server: {
    port: 9000,
    proxy: {
      // /api is the documentation page; only nested paths are backend requests.
      '/api/': 'http://localhost:8787',
    },
  },
})
