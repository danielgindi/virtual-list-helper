import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import vue from '@vitejs/plugin-vue';

const supportedBrowsers = ['chromium', 'firefox', 'webkit'] as const;
type BrowserName = typeof supportedBrowsers[number];
const browsers = (process.env.TEST_BROWSERS || 'chromium')
    .split(',')
    .map(name => name.trim());

for (const browser of browsers) {
    if (!supportedBrowsers.includes(browser as BrowserName))
        throw new Error('Unsupported TEST_BROWSERS entry: ' + browser);
}

export default defineConfig({
    plugins: [vue()],
    resolve: {
        // Exercise the current source when the Vue binding imports the generated JS entry.
        alias: { '../lib/index.js': fileURLToPath(new URL('./src/index.ts', import.meta.url)) },
    },
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'browser',
                    include: ['tests/browser/**/*.test.ts'],
                    browser: {
                        enabled: true,
                        headless: true,
                        viewport: { width: 800, height: 600 },
                        provider: playwright(),
                        instances: browsers.map(browser => ({ browser: browser as BrowserName })),
                    },
                },
            },
            {
                extends: true,
                test: {
                    name: 'package',
                    environment: 'node',
                    include: ['tests/package/**/*.test.ts'],
                    testTimeout: 60_000,
                },
            },
        ],
    },
});
