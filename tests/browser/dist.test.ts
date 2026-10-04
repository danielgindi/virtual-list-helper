import { describe, expect, it } from 'vitest';
import SourceHelper from '../../src/index';
import { createFixture } from './fixture';

// Dynamic URLs keep Vite from replacing a generated module with source code.
const entries = [
    '/lib/index.js',
    '/dist/virtual-list-helper.es6.js',
    '/dist/virtual-list-helper.es6.min.js',
];

describe.each(entries)('built browser entry %s', entry => {
    it('exports a usable constructor and renders and scrolls with real layout', async () => {
        const { default: Helper } = await import(/* @vite-ignore */ entry) as { default: typeof SourceHelper };
        expect(typeof Helper).toBe('function');
        const { helper, list } = createFixture({}, Helper);
        helper.render();
        expect(helper.getItemElementAt(0)!.textContent).toBe('0');
        expect(helper.estimateFullHeight()).toBe(2000);
        list.scrollTop = 400;
        helper.render();
        expect(helper.getItemElementAt(20)!.textContent).toBe('20');
        expect(helper.getItemElementAt(20)!.getBoundingClientRect().top).toBeCloseTo(list.getBoundingClientRect().top);
        helper.destroy();
        expect(list.children).toHaveLength(0);
    });
});
