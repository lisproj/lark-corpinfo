import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { vitePluginForArco } from '@arco-plugins/vite-vue'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vitePluginForArco({
      style: 'css',
      theme: '@arco-themes/vue-lark-base-plugin',
    }),
  ],
  server: {
    host: '0.0.0.0',
  },
  build: {
    target: 'esnext',
    emptyOutDir: true, // build前清空outdir
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
