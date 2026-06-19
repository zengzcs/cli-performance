import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    minify: false,
    lib: {
      entry: 'src/cli.tsx',
      formats: ['es'],
      fileName: () => 'cli.js',
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', 'ink', 'ink-print-cluster', 'ssh2', 'os', 'fs', 'path'],
    },
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});
