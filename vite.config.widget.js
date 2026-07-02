import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { copyFileSync, cpSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'import.meta.env.VITE_WIDGET': JSON.stringify('true'),
  },
  build: {
    outDir: 'dist-widget',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/widget-entry.js'),
      formats: ['es'],
      fileName: () => 'wobblescope.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (info) => {
          if (info.name?.endsWith('.css')) return 'wobblescope.css';
          return 'assets/[name][extname]';
        },
      },
    },
    cssCodeSplit: false,
  },
  plugins: [
    {
      name: 'bundle-widget-shell',
      closeBundle() {
        const out = resolve(__dirname, 'dist-widget');
        mkdirSync(out, { recursive: true });
        copyFileSync(
          resolve(__dirname, 'widget/wobblescope.html'),
          resolve(out, 'wobblescope.html'),
        );
        const publicAssets = resolve(__dirname, 'public/assets');
        if (existsSync(publicAssets)) {
          cpSync(publicAssets, resolve(out, 'assets'), { recursive: true });
        }
        const publicTextures = resolve(__dirname, 'public/textures');
        if (existsSync(publicTextures)) {
          cpSync(publicTextures, resolve(out, 'textures'), { recursive: true });
        }
        const publicData = resolve(__dirname, 'public/data');
        if (existsSync(publicData)) {
          cpSync(publicData, resolve(out, 'data'), { recursive: true });
        }
      },
    },
  ],
});