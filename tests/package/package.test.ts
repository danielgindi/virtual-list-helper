import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const bundles = ['es6', 'es6.min', 'umd', 'umd.min', 'cjs', 'cjs.min'];

function bundlePath(format: string) {
    const extension = format.startsWith('cjs') ? '.cjs' : '.js';
    return resolve(root, 'dist/virtual-list-helper.' + format + extension);
}

function loadScript(format: string) {
    const module = { exports: {} };
    const context = {
        ...(format.startsWith('cjs') ? { module, exports: module.exports } : {}),
        Element: class {},
        require: (name: string) => {
            expect(name).toBe('@danielgindi/dom-utils/lib/Css.js');
            return { getElementOffset: () => ({ top: 0, left: 0 }) };
        },
        domUtilsCss: { getElementOffset: () => ({ top: 0, left: 0 }) },
    };
    const file = bundlePath(format);
    runInNewContext(readFileSync(file, 'utf8'), context, { filename: file });
    return format.startsWith('cjs') ? module.exports : (context as typeof context & { VirtualListHelper: unknown }).VirtualListHelper;
}

describe('built and published package', () => {
    it.each(bundles)('ships the %s bundle, version banner, and usable source map', format => {
        const file = bundlePath(format);
        const code = readFileSync(file, 'utf8');
        expect(code).toContain(pkg.name + ' ' + pkg.version);
        expect(code).toContain('sourceMappingURL=');
        const map = JSON.parse(readFileSync(file + '.map', 'utf8'));
        expect(map.version).toBe(3);
        expect(map.sources.length).toBeGreaterThan(0);
        expect(map.mappings.length).toBeGreaterThan(0);
        expect(map.sourcesContent.some((content: string) => content.includes('class VirtualListHelper'))).toBe(true);
    });

    it.each(['umd', 'umd.min', 'cjs', 'cjs.min'])('evaluates the %s script and exports the helper', format => {
        const Helper = loadScript(format) as new (options: { list: Element; count: number }) => {
            getCount(): number;
            estimateFullHeight(): number;
            destroy(): void;
        };
        expect(typeof Helper).toBe('function');
        const helper = new Helper({
            list: { addEventListener() {}, removeEventListener() {} } as unknown as Element,
            count: 5,
        });
        expect(helper.getCount()).toBe(5);
        expect(helper.estimateFullHeight()).toBe(100);
        helper.destroy();
    });

    it('loads the advertised ESM entry in Node with its real dependency', () => {
        const entry = pathToFileURL(resolve(root, pkg.module)).href;
        const script = 'globalThis.Element = class {};'
            + 'const { default: Helper } = await import(' + JSON.stringify(entry) + ');'
            + 'const helper = new Helper({ list: { addEventListener() {}, removeEventListener() {} }, count: 5 });'
            + 'process.stdout.write(String(helper.estimateFullHeight()));';
        const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: root, encoding: 'utf8' });
        expect(output).toBe('100');
    });

    it('publishes the runtime entries, Vue component, declarations, and map sources', () => {
        // npm's CLI is JavaScript, so invoking it through Node is portable on Windows too.
        const npmCli = process.env.npm_execpath;
        expect(npmCli).toBeTruthy();
        const output = execFileSync(process.execPath, [npmCli!, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
            cwd: root,
            encoding: 'utf8',
            env: { ...process.env, HUSKY: '0' },
        });
        const [{ files }] = JSON.parse(output.slice(output.indexOf('['))) as [{ files: { path: string }[] }];
        const paths = files.map(file => file.path);
        for (const path of [pkg.main, pkg.module, pkg.types, 'vue/index.js', 'vue/index.d.ts', 'vue/VirtualList.vue', 'vue/VirtualList.vue.d.ts', 'src/index.ts'])
            expect(paths).toContain(path);
        expect(paths.some(path => path.startsWith('tests/'))).toBe(false);
        expect(paths.some(path => path.startsWith('scripts/'))).toBe(false);
        for (const path of [pkg.main, pkg.module, pkg.types])
            expect(existsSync(resolve(root, path))).toBe(true);
    });

    it.each([root, bundlePath('cjs'), bundlePath('cjs.min')])('requires the CommonJS entry %s with its real dependency', entry => {
        const script = 'globalThis.Element = class {};'
            + 'const Helper = require(' + JSON.stringify(entry) + ');'
            + 'const helper = new Helper({ list: { addEventListener() {}, removeEventListener() {} }, count: 5 });'
            + 'process.stdout.write(String(helper.estimateFullHeight()));';
        const output = execFileSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8' });
        expect(output).toBe('100');
    });
});
