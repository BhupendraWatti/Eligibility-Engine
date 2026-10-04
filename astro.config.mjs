// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare'
  }),
  integrations: [react()],
  vite: {
    cacheDir: process.argv.includes('build') ? 'node_modules/.vite-build' : 'node_modules/.vite-dev',
    plugins: [tailwindcss()]
  }
});
