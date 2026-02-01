/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: [resolve(__dirname, 'vitest-setup.ts')]
	},
	resolve: {
		conditions: ['browser']
	},
	server: {
		fs: {
			allow: [
				'.',
				'../node_modules',
				'/Users/bruno/Documents/khi-project/kobo-highlights-exporter/node_modules'
			]
		}
	}
});
