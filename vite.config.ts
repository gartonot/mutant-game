import { defineConfig } from 'vite';
import * as path from 'path'

export default defineConfig({
    // GitHub Actions supplies the Pages path; local development stays at /.
    base: process.env.PAGES_BASE_PATH || '/',
    build: {
        rollupOptions: {
            input: { game: path.resolve(__dirname, 'index.html'), sounds: path.resolve(__dirname, 'sound-sandbox.html') },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@entities': path.resolve(__dirname, './src/entities'),
        },
    },
});
