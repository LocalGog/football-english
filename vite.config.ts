import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The whole app is inlined into one index.html: one request on first load,
// trivial offline caching, and no path problems on GitHub Pages sub-folders.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
