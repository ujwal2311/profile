/**
 * vite.config.js — Vite Build Configuration
 * 
 * Why Vite? Lightning-fast HMR dev server with native ES modules,
 * plus optimized Rollup production builds. Only plugin needed is
 * @vitejs/plugin-react for JSX transform + Fast Refresh.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    // Force a single copy of React (prevents "Should have a queue" errors
    // when dependencies like react-konva resolve their own React)
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
