import { afterEach, vi } from 'vitest';
import VirtualListHelper from '../../src/index';
import type { VirtualListHelperOptions } from '../../src/index';

const fixtures: { helper: VirtualListHelper; list: HTMLElement }[] = [];

export function createFixture(
    options: Partial<VirtualListHelperOptions> = {},
    Helper: typeof VirtualListHelper = VirtualListHelper,
) {
    const list = document.createElement('div');
    list.style.cssText = 'position:relative;width:200px;height:100px;overflow:auto;padding:0;border:0;';
    document.body.appendChild(list);

    const createItem = vi.fn(() => {
        const element = document.createElement('div');
        element.style.cssText = 'display:block;height:20px;margin:0;padding:0;border:0;box-sizing:border-box;';
        return element;
    });
    const onItemRender = vi.fn((element: Element, index: number) => {
        element.textContent = String(index);
    });
    const onItemUnrender = vi.fn();
    const onScrollHeightChange = vi.fn();
    const helper = new Helper({
        list,
        count: 100,
        buffer: 0,
        hookScrollEvent: false,
        itemElementCreatorFn: createItem,
        onItemRender,
        onItemUnrender,
        onScrollHeightChange,
        ...options,
    });
    fixtures.push({ helper, list });
    return { helper, list, createItem, onItemRender, onItemUnrender, onScrollHeightChange };
}

export function renderedIndices(helper: VirtualListHelper, list: Element) {
    return Array.from(list.querySelectorAll('*'))
        .map(element => helper.getItemIndexFromElement(element))
        .filter((index): index is number => index !== undefined);
}

afterEach(() => {
    for (const { helper, list } of fixtures.splice(0)) {
        helper.destroy();
        list.remove();
    }
    vi.restoreAllMocks();
});
