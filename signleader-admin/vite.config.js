import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/upload': 'http://localhost:3000',
      '/query': 'http://localhost:3000'
    }
  }
});
