import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => {
  const standalone = mode === 'standalone';
  return {
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    ...(standalone ? { build: { outDir: 'dist-standalone', rollupOptions: { input: 'standalone.html' } } } : {}),
  };
});
