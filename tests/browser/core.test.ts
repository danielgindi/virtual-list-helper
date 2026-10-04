import { describe, expect, it, vi } from 'vitest';
import { createFixture, renderedIndices } from './fixture';

describe('configuration and estimates', () => {
    it('applies constructor options and supports fluent setters', () => {
        const { helper } = createFixture({ count: 12, virtual: false, buffer: 3, estimatedItemHeight: 25 });
        expect(helper.getCount()).toBe(12);
        expect(helper.isVirtual()).toBe(false);
        expect(helper.getBuffer()).toBe(3);
        expect(helper.getEstimatedItemHeight()).toBe(25);
        expect(helper.isHookScrollEventEnabled()).toBe(false);
        expect(helper.setBuffer(-2).setEstimatedItemHeight(-30).setCount(8)).toBe(helper);
        expect(helper.getBuffer()).toBe(2);
        expect(helper.getEstimatedItemHeight()).toBe(30);
        expect(helper.getCount()).toBe(8);
        helper.setVirtual().setHookScrollEvent().setAutoVirtualWrapperWidth();
        expect(helper.isVirtual()).toBe(true);
        expect(helper.isHookScrollEventEnabled()).toBe(true);
        expect(helper.isAutoVirtualWrapperWidth()).toBe(true);
    });

    it('combines per-item estimates with the default and invalidates cached positions', () => {
        const { helper } = createFixture({
            count: 4,
            itemHeightEstimatorFn: index => index === 0 ? 10 : index === 2 ? 30 : undefined,
        });
        expect([0, 1, 2, 3].map(index => helper.getItemPosition(index))).toEqual([0, 10, 30, 60]);
        expect(helper.estimateFullHeight()).toBe(80);
        helper.setItemHeightEstimatorFn(null).setEstimatedItemHeight(15).invalidatePositions();
        expect(helper.getItemPosition(3)).toBe(45);
        expect(helper.estimateFullHeight()).toBe(60);
    });

    it('handles an empty list and out-of-range lookups', () => {
        const { helper, list } = createFixture({ count: 0 });
        helper.render();
        expect(helper.estimateFullHeight()).toBe(0);
        expect(list.textContent).toBe('');
        for (const index of [-1, 0, 100]) {
            expect(helper.getItemElementAt(index)).toBeUndefined();
            expect(helper.getItemPosition(index)).toBeUndefined();
            expect(helper.getItemSize(index)).toBeUndefined();
            expect(helper.isItemRendered(index)).toBe(false);
        }
        expect(helper.getItemIndexFromElement(document.createElement('div'))).toBeUndefined();
    });
});

describe('virtual rendering and browser layout', () => {
    it('renders only the viewport and requested buffer, with accurate positions', () => {
        const { helper, list } = createFixture({ buffer: 2 });
        helper.render();
        expect(renderedIndices(helper, list)).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(helper.getVisibleItemCount()).toBe(5);
        expect(helper.estimateFullHeight()).toBe(2000);
        expect(list.scrollHeight).toBe(2000);
        expect(helper.isItemRendered(7)).toBe(false);
        const element = helper.getItemElementAt(3)!;
        expect(element.getBoundingClientRect().top - list.getBoundingClientRect().top).toBeCloseTo(60);
        expect(helper.getItemSize(3)).toBe(20);
    });

    it('reuses elements while scrolling forward and backward without stale content', () => {
        const { helper, list, createItem, onItemUnrender } = createFixture();
        helper.render();
        const elements = new Set(Array.from(list.firstElementChild!.children));
        for (const top of [400, 1200, 200, 0]) {
            list.scrollTop = top;
            helper.render();
            const first = top / 20;
            expect(renderedIndices(helper, list)).toEqual([first, first + 1, first + 2, first + 3, first + 4]);
            for (let index = first; index < first + 5; index++) {
                const element = helper.getItemElementAt(index)!;
                expect(elements.has(element)).toBe(true);
                expect(element.textContent).toBe(String(index));
                expect(helper.getItemIndexFromElement(element)).toBe(index);
            }
        }
        expect(createItem).toHaveBeenCalledTimes(5);
        expect(onItemUnrender).toHaveBeenCalled();
    });

    it('hooks scroll events only when enabled, and supports explicit rendering', () => {
        const { helper, list } = createFixture({ hookScrollEvent: true });
        helper.render();
        list.scrollTop = 200;
        list.dispatchEvent(new Event('scroll'));
        expect(helper.isItemRendered(10)).toBe(true);
        helper.setHookScrollEvent(false);
        list.scrollTop = 400;
        list.dispatchEvent(new Event('scroll'));
        expect(helper.isItemRendered(20)).toBe(false);
        helper.render();
        expect(helper.isItemRendered(20)).toBe(true);
        helper.setHookScrollEvent(true);
        list.scrollTop = 600;
        list.dispatchEvent(new Event('scroll'));
        expect(helper.isItemRendered(30)).toBe(true);
    });

    it('renders the final viewport without extra or out-of-range items', () => {
        const { helper, list } = createFixture({ count: 100, buffer: 2 });
        helper.render();
        list.scrollTop = list.scrollHeight;
        helper.render();
        expect(list.scrollTop).toBe(1900);
        expect(renderedIndices(helper, list)).toEqual([93, 94, 95, 96, 97, 98, 99]);
        expect(helper.getItemElementAt(100)).toBeUndefined();
    });

    it('updates the render buffer and shrinks to an empty list', () => {
        const { helper, list } = createFixture();
        helper.render();
        helper.setBuffer(3).render();
        expect(renderedIndices(helper, list)).toHaveLength(8);
        helper.setCount(2).render();
        expect(renderedIndices(helper, list)).toEqual([0, 1]);
        helper.setCount(0).render();
        expect(renderedIndices(helper, list)).toEqual([]);
        expect(list.scrollHeight).toBe(list.clientHeight);
    });

    it('unhooks virtual scrolling and stops rendering after destroy', () => {
        const { helper, list, onItemRender } = createFixture({ hookScrollEvent: true });
        const removeListener = vi.spyOn(list, 'removeEventListener');
        helper.render();
        helper.destroy();
        const renderedCount = onItemRender.mock.calls.length;
        expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        expect(list.children).toHaveLength(0);
        list.dispatchEvent(new Event('scroll'));
        helper.render();
        helper.destroy();
        expect(onItemRender).toHaveBeenCalledTimes(renderedCount);
    });

    it('corrects overestimated heights to fill the viewport', () => {
        const { helper, list } = createFixture({ count: 20, estimatedItemHeight: 100 });
        helper.render();
        expect(renderedIndices(helper, list)).toEqual([0, 1, 2, 3, 4]);
        expect(helper.getItemElementAt(4)!.getBoundingClientRect().bottom).toBeCloseTo(list.getBoundingClientRect().bottom);
        expect(helper.getItemPosition(5)).toBe(100);
    });

    it('measures variable heights and recalculates positions after a height change', () => {
        const heights = [10, 30, 15, 25, 20, 20];
        const { helper, list } = createFixture({
            count: heights.length,
            itemHeightEstimatorFn: index => heights[index],
            onItemRender: (element, index) => {
                (element as HTMLElement).style.height = heights[index] + 'px';
                element.textContent = String(index);
            },
        });
        helper.render();
        expect([0, 1, 2, 3, 4, 5].map(index => helper.getItemPosition(index))).toEqual([0, 10, 40, 55, 80, 100]);
        expect(helper.estimateFullHeight()).toBe(120);
        heights[1] = 50;
        helper.refreshItemAt(1).render();
        expect(helper.getItemPosition(2)).toBe(60);
        expect(helper.estimateFullHeight()).toBe(140);
        const element = helper.getItemElementAt(2)!;
        expect(element.getBoundingClientRect().top - list.getBoundingClientRect().top).toBeCloseTo(60);
    });

    it('keeps equal positions for zero-height items and still fills the viewport', () => {
        const heights = [0, 0, 20, 20, 20, 20, 20, 20];
        const { helper } = createFixture({
            count: heights.length,
            itemHeightEstimatorFn: index => heights[index],
            onItemRender: (element, index) => { (element as HTMLElement).style.height = heights[index] + 'px'; },
        });
        helper.render();
        expect([0, 1, 2, 3].map(index => helper.getItemPosition(index))).toEqual([0, 0, 0, 20]);
        expect(helper.isItemRendered(6)).toBe(true);
        expect(helper.estimateFullHeight()).toBe(120);
    });

    it('notifies height changes only when the wrapper height changes', () => {
        const { helper, onScrollHeightChange } = createFixture({ count: 10 });
        helper.render();
        expect(onScrollHeightChange).toHaveBeenCalledExactlyOnceWith(200);
        helper.render();
        expect(onScrollHeightChange).toHaveBeenCalledTimes(1);
        helper.setCount(5).render();
        expect(onScrollHeightChange).toHaveBeenLastCalledWith(100);
        expect(onScrollHeightChange).toHaveBeenCalledTimes(2);
    });

    it('uses a supplied wrapper, applies explicit width changes, and preserves it on destroy', () => {
        const parent = document.createElement('section');
        const { helper, list } = createFixture({ itemsParent: parent, count: 3 });
        list.appendChild(parent);
        helper.setAutoVirtualWrapperWidth(true).render();
        expect(parent.style.width).toBe('100%');
        expect(parent.children).toHaveLength(3);
        helper.setAutoVirtualWrapperWidth(false);
        expect(parent.style.width).toBe('');
        helper.destroy();
        expect(parent.parentElement).toBe(list);
        expect(parent.children).toHaveLength(0);
    });
});

describe('mutations, modes, and resource cleanup', () => {
    it.each([true, false])('adds and removes items in the middle (virtual=%s)', virtual => {
        const items = ['a', 'b', 'c', 'd'];
        const { helper, list } = createFixture({
            count: items.length,
            virtual,
            onItemRender: (element, index) => { element.textContent = items[index]; },
        });
        helper.render();
        const firstElement = helper.getItemElementAt(0);
        items.splice(1, 0, 'x', 'y');
        helper.addItemsAt(2, 1).render();
        expect(helper.getCount()).toBe(6);
        expect(helper.getItemElementAt(0)).toBe(firstElement);
        expect(helper.getItemElementAt(1)!.textContent).toBe('x');
        expect(helper.getItemElementAt(2)!.textContent).toBe('y');
        items.splice(1, 2);
        helper.removeItemsAt(2, 1).render();
        expect(helper.getCount()).toBe(4);
        expect(renderedIndices(helper, list)).toEqual([0, 1, 2, 3]);
        expect([0, 1, 2, 3].map(index => helper.getItemElementAt(index)!.textContent)).toEqual(items);
    });

    it.each([true, false])('appends items and ignores invalid mutations (virtual=%s)', virtual => {
        const { helper } = createFixture({ count: 3, virtual });
        helper.render();
        helper.addItemsAt(2).render();
        expect(helper.getCount()).toBe(5);
        expect(helper.getItemElementAt(4)!.textContent).toBe('4');
        helper.addItemsAt(0).addItemsAt(-1).removeItemsAt(2, -1).removeItemsAt(2, 99).refreshItemAt(-1);
        expect(helper.getCount()).toBe(5);
        helper.removeItemsAt(2, 3).render();
        expect(helper.getCount()).toBe(3);
    });

    it.each([true, false])('refreshes item contents while reusing the element pool (virtual=%s)', virtual => {
        let label = 'before';
        const { helper } = createFixture({ count: 3, virtual, onItemRender: element => { element.textContent = label; } });
        helper.render();
        const element = helper.getItemElementAt(1);
        const pool = new Set([0, 1, 2].map(index => helper.getItemElementAt(index)));
        label = 'after';
        helper.refreshItemAt(1);
        if (virtual)
            helper.render();
        if (!virtual)
            expect(helper.getItemElementAt(1)).toBe(element);
        expect(pool.has(helper.getItemElementAt(1))).toBe(true);
        expect(helper.getItemElementAt(1)!.textContent).toBe('after');
        expect(helper.getItemElementAt(0)!.textContent).toBe('before');
    });

    it('switches between virtual and normal flow and invalidates changed contents', () => {
        const { helper, list } = createFixture({ count: 12 });
        helper.render();
        expect(renderedIndices(helper, list)).toHaveLength(5);
        helper.setVirtual(false).render();
        expect(list.children).toHaveLength(12);
        expect(helper.getItemPosition(3)).toBeCloseTo(60);
        helper.setOnItemRender((element, index) => { element.textContent = 'new-' + index; }).invalidate().render();
        expect(helper.getItemElementAt(3)!.textContent).toBe('new-3');
        helper.setVirtual(true).render();
        expect(list.children).toHaveLength(1);
        expect(renderedIndices(helper, list)).toHaveLength(5);
    });

    it('falls back to the default item creator and clears old content before reuse', () => {
        const { helper, list } = createFixture({ count: 3 });
        helper.setItemElementCreatorFn(null).setOnItemRender((element, index) => {
            expect(element.innerHTML).toBe('');
            element.innerHTML = '<span>' + index + '</span>';
            (element as HTMLElement).style.height = '20px';
        }).render();
        expect(helper.getItemElementAt(0)!.tagName).toBe('LI');
        helper.invalidate().render();
        expect(list.querySelectorAll('span')).toHaveLength(3);
    });

    it.each([true, false])('tests ghost elements synchronously and cleans up even when the tester throws (append=%s)', append => {
        const { helper, list, onItemUnrender } = createFixture({ count: 0 });
        let ghost: Element | undefined;
        const tester = vi.fn((element: Element) => {
            ghost = element;
            expect(element.textContent).toBe('42');
            expect(element.isConnected).toBe(append);
            throw new Error('tester failed');
        });
        expect(() => helper.createGhostItemElement(42, append, tester)).toThrow('tester failed');
        expect(tester).toHaveBeenCalledTimes(1);
        expect(ghost!.isConnected).toBe(false);
        expect(list.children).toHaveLength(0);
        expect(onItemUnrender).toHaveBeenCalledExactlyOnceWith(ghost);
    });

    it('destroys normal-flow resources once, removes scroll listeners, and ignores later rendering', () => {
        const { helper, list, onItemRender, onItemUnrender } = createFixture({ hookScrollEvent: true, virtual: false, count: 5 });
        const removeListener = vi.spyOn(list, 'removeEventListener');
        helper.render();
        const count = onItemRender.mock.calls.length;
        helper.destroy();
        expect(list.children).toHaveLength(0);
        expect(onItemUnrender).toHaveBeenCalledTimes(count);
        expect(removeListener).toHaveBeenCalledWith('scroll', expect.any(Function));
        helper.destroy();
        list.dispatchEvent(new Event('scroll'));
        helper.render();
        expect(onItemUnrender).toHaveBeenCalledTimes(count);
        expect(onItemRender).toHaveBeenCalledTimes(count);
    });
});

describe('regression fixes', () => {
    it.each([true, false])('counts only the five visible items at the bottom (virtual=%s)', virtual => {
        const { helper, list } = createFixture({ virtual });
        helper.render();
        list.scrollTop = list.scrollHeight;
        helper.render();
        expect(helper.getVisibleItemCount()).toBe(5);
    });

    it.each([false, true])('cleans up every virtual item during destroy, even after invalidation (invalidated=%s)', invalidated => {
        const { helper, onItemRender, onItemUnrender } = createFixture();
        helper.render();
        const count = onItemRender.mock.calls.length;
        if (invalidated)
            helper.invalidate();
        helper.destroy();
        helper.destroy();
        expect(onItemUnrender).toHaveBeenCalledTimes(count);
    });

    it.each([undefined, true, false])('honors autoVirtualWrapperWidth in the constructor (option=%s)', option => {
        const { helper, list } = createFixture({ autoVirtualWrapperWidth: option });
        helper.render();
        expect(helper.isAutoVirtualWrapperWidth()).toBe(option ?? true);
        expect((list.firstElementChild as HTMLElement).style.width).toBe(option === false ? '' : '100%');
    });

    it('uses measured heights for the requested item when estimates differ', () => {
        const heights = [10, 30, 50];
        const { helper } = createFixture({
            count: 3,
            estimatedItemHeight: 20,
            onItemRender: (element, index) => { (element as HTMLElement).style.height = heights[index] + 'px'; },
        });
        helper.render();
        expect([0, 1, 2].map(index => helper.getItemSize(index))).toEqual(heights);
    });

    it('getItemSize returns the requested item height rather than the previous item height', () => {
        const { helper } = createFixture({ count: 3, itemHeightEstimatorFn: index => [10, 30, 50][index] });
        expect([0, 1, 2].map(index => helper.getItemSize(index))).toEqual([10, 30, 50]);
        helper.setItemHeightEstimatorFn(null).invalidatePositions();
        expect(helper.getItemSize(0)).toBe(20);
    });

    it.each([true, false])('reports zero visible items for an empty list (virtual=%s)', virtual => {
        const { helper } = createFixture({ count: 0, virtual });
        helper.render();
        expect(helper.getVisibleItemCount()).toBe(0);
    });
});
