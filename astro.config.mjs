// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Locale selection is request-specific during the compatibility rollout.
  // Public locale-prefixed routes can be prerendered individually once released.
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile',
    prerenderEnvironment: 'node',
  }),
});
