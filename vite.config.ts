

import path from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    build: {
        outDir: 'docs'
    },
    base: './', // Ensures relative asset paths
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'data',
            dest: ''
          }
        ]
      })
    ]
});