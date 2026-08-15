import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function buildExtension() {
  console.log('🚀 Building optimized production f-insight extension...');

  const distDir = resolve(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Build Popup (HTML + React app)
  console.log('📦 1/3 Building Popup UI...');
  await build({
    root: rootDir,
    configFile: false,
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
      },
    },
    esbuild: {
      legalComments: 'none',
      treeShaking: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: 'esbuild',
      cssMinify: true,
      target: 'es2020',
      rollupOptions: {
        treeshake: 'recommended',
        input: {
          popup: resolve(rootDir, 'popup.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });

  // 2. Build Background Service Worker (Single Standalone File)
  console.log('⚙️ 2/3 Building Background Service Worker...');
  await build({
    root: rootDir,
    configFile: false,
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    esbuild: {
      legalComments: 'none',
      treeShaking: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: 'esbuild',
      target: 'es2020',
      lib: {
        entry: resolve(rootDir, 'src/background/index.ts'),
        formats: ['es'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        treeshake: 'recommended',
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'background.js',
        },
      },
    },
  });

  // 3. Build Content Script (Single Standalone IIFE File)
  console.log('💉 3/3 Building Content Script (IIFE Standalone)...');
  await build({
    root: rootDir,
    configFile: false,
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(rootDir, 'src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    esbuild: {
      legalComments: 'none',
      treeShaking: true,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      minify: 'esbuild',
      cssMinify: true,
      target: 'es2020',
      lib: {
        entry: resolve(rootDir, 'src/content/index.tsx'),
        formats: ['iife'],
        name: 'FInsightContent',
        fileName: () => 'content.js',
      },
      rollupOptions: {
        treeshake: 'recommended',
        output: {
          inlineDynamicImports: true,
          entryFileNames: 'content.js',
          extend: true,
        },
      },
    },
  });

  // 4. Copy manifest.json and icons to dist/
  console.log('📋 Copying Manifest and Icons...');
  fs.copyFileSync(
    resolve(rootDir, 'public/manifest.json'),
    resolve(distDir, 'manifest.json')
  );

  const iconsSrcDir = resolve(rootDir, 'public/icons');
  const iconsDistDir = resolve(distDir, 'icons');
  if (fs.existsSync(iconsSrcDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
    for (const icon of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(resolve(iconsSrcDir, icon), resolve(iconsDistDir, icon));
    }
  }

  console.log('✅ Build complete! All files generated cleanly in dist/');
}

buildExtension().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
