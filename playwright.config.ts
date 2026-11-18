import { defineConfig } from '@playwright/test';
import { BASE_URL, PORT } from './tests/visual/harness';

/**
 * The visual parity harness (tests/visual/README.md): the production build in
 * WebKit, with the Tauri runtime mocked. Separate from Vitest, which only
 * runs `src/**\/*.{test,spec}.ts`.
 */
export default defineConfig({
	testDir: 'tests/visual',
	testMatch: '*.spec.ts',
	outputDir: 'tests/visual/output/playwright',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	timeout: 60_000,
	reporter: [['list']],
	globalSetup: './tests/visual/global-setup.ts',
	globalTeardown: './tests/visual/global-teardown.ts',
	// Each capture opens its own context (tests/visual/harness.ts)
	use: { baseURL: BASE_URL },
	projects: [{ name: 'webkit', use: { browserName: 'webkit' } }],
	webServer: {
		command: `node tests/visual/serve.ts ${PORT}`,
		url: `${BASE_URL}/`,
		reuseExistingServer: false,
		stdout: 'ignore'
	}
});
