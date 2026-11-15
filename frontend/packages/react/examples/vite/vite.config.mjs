import { defineConfig } from 'vite';
const proxy = { '/api': { target: process.env.ORBI_BACKEND_URL ?? 'http://127.0.0.1:8088', changeOrigin: true } };
export default defineConfig({ server: { proxy }, preview: { proxy } });
