import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(args) {
          args.startup();
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['sql.js', 'electron', 'electron-log', 'electron-updater'],
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
                chunkFileNames: '[name].cjs',
                exports: 'named',
              },
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
