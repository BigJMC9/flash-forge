import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pythonSidecarBridge } from './dev/sidecarBridge';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '');
        return path.resolve(currentDir, 'src/assets', filename);
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    pythonSidecarBridge(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(currentDir, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
});
