import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyDirFirst: true,
        rollupOptions: {
            input: {
                content: resolve(__dirname, 'src/content/index.js'),
                background: resolve(__dirname, 'src/background.js'),
                popup: resolve(__dirname, 'src/popup.js'),
                panel: resolve(__dirname, 'src/panel.js')
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]',
                // Ensure no code splitting - each entry is self-contained
                manualChunks: undefined
            }
        },
        // Don't minify for easier debugging
        minify: false,
        // Generate source maps
        sourcemap: true
    },
    publicDir: 'public'
});
