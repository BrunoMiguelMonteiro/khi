import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest-setup.ts']
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
