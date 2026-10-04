import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import type { App, ComponentPublicInstance } from 'vue';
import VirtualList from '../../vue/VirtualList.vue';

const mounted: { app: App; container: HTMLElement }[] = [];
const listStyle = 'position:relative;width:200px;height:100px;overflow:auto;';
const createItem = () => {
    const element = document.createElement('div');
    element.style.height = '20px';
    return element;
};

async function flushRender() {
    // Watchers, invalidation, and rendering run in successive nextTick callbacks.
    await nextTick();
    await nextTick();
    await nextTick();
}

function mount(render: () => ReturnType<typeof h>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp(defineComponent({ render }));
    app.mount(container);
    mounted.push({ app, container });
    return { app, container };
}

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
        // Detached slot VNodes in the existing binding emit this known warning.
        // All other Vue warnings remain test failures.
        if (!String(args[0]).includes('Slot "default" invoked outside of the render function'))
            throw new Error(args.map(String).join(' '));
    });
});

afterEach(() => {
    for (const { app, container } of mounted.splice(0)) {
        app.unmount();
        container.remove();
    }
    vi.restoreAllMocks();
});

describe('Vue binding', () => {
    it('renders the requested root tag, attributes, and item slot data', () => {
        const { container } = mount(() => h(VirtualList, {
            tag: 'section',
            id: 'list',
            style: listStyle,
            virtual: false,
            items: ['alpha', 'beta'],
            count: 99,
            itemElementCreatorFn: createItem,
        }, { default: ({ index, item }: { index: number; item: unknown }) => h('span', index + ':' + item) }));
        const list = container.querySelector('section')!;
        expect(list.id).toBe('list');
        expect(Array.from(list.children, element => element.textContent)).toEqual(['0:alpha', '1:beta']);
    });

    it('reacts to count changes and replacement of the items array', async () => {
        const count = ref(2);
        const items = ref<string[] | null>(null);
        const { container } = mount(() => h(VirtualList, {
            style: listStyle,
            virtual: false,
            count: count.value,
            items: items.value,
            itemElementCreatorFn: createItem,
        }, { default: ({ index, item }: { index: number; item?: unknown }) => h('span', item === undefined ? String(index) : String(item)) }));
        const list = container.firstElementChild!;
        expect(list.children).toHaveLength(2);
        count.value = 4;
        await flushRender();
        expect(list.children).toHaveLength(4);
        items.value = ['a', 'b', 'c'];
        await flushRender();
        expect(Array.from(list.children, element => element.textContent)).toEqual(['a', 'b', 'c']);
        items.value = ['x', 'y', 'z'];
        await flushRender();
        expect(Array.from(list.children, element => element.textContent)).toEqual(['x', 'y', 'z']);
    });

    it('switches rendering mode and toggles wrapper width through reactive props', async () => {
        const virtual = ref(false);
        const autoWidth = ref(false);
        const { container } = mount(() => h(VirtualList, {
            style: listStyle,
            count: 20,
            virtual: virtual.value,
            autoVirtualWrapperWidth: autoWidth.value,
            buffer: 0,
            itemElementCreatorFn: createItem,
        }, { default: ({ index }: { index: number }) => h('span', String(index)) }));
        const list = container.firstElementChild!;
        expect(list.children).toHaveLength(20);
        virtual.value = true;
        await flushRender();
        expect(list.children).toHaveLength(1);
        expect(list.firstElementChild!.children).toHaveLength(5);
        autoWidth.value = true;
        await flushRender();
        expect((list.firstElementChild as HTMLElement).style.width).toBe('100%');
        virtual.value = false;
        await flushRender();
        expect(list.children).toHaveLength(20);
    });

    it('emits scroll-height changes and exposes explicit invalidation methods', async () => {
        const instance = ref<ComponentPublicInstance & { invalidate(): void; invalidatePositions(): void }>();
        const onHeight = vi.fn();
        const { container } = mount(() => h(VirtualList, {
            ref: instance,
            style: listStyle,
            count: 20,
            buffer: 0,
            itemElementCreatorFn: createItem,
            onScrollHeightChange: onHeight,
        }, { default: ({ index }: { index: number }) => h('span', String(index)) }));
        expect(onHeight).toHaveBeenLastCalledWith(400);
        instance.value!.invalidatePositions();
        instance.value!.invalidate();
        await flushRender();
        expect(container.querySelectorAll('span')).toHaveLength(5);
        expect(onHeight).toHaveBeenCalledTimes(1);
    });

    it('updates virtual item slot contents while scrolling', async () => {
        const { container } = mount(() => h(VirtualList, {
            style: listStyle,
            count: 100,
            buffer: 0,
            itemElementCreatorFn: createItem,
        }, { default: ({ index }: { index: number }) => h('span', String(index)) }));
        const list = container.firstElementChild!;
        (list as HTMLElement).scrollTop = 400;
        list.dispatchEvent(new Event('scroll'));
        await flushRender();
        expect(Array.from(list.querySelectorAll('span'), element => element.textContent)).toEqual(['20', '21', '22', '23', '24']);
    });

    it('uses changed reactive height settings on the next requested render', async () => {
        const instance = ref<{ invalidatePositions(): void }>();
        const estimatedHeight = ref(20);
        const onHeight = vi.fn();
        const { container } = mount(() => h(VirtualList, {
            style: listStyle,
            count: 100,
            buffer: 0,
            ref: instance,
            estimatedItemHeight: estimatedHeight.value,
            itemElementCreatorFn: createItem,
            onScrollHeightChange: onHeight,
        }, { default: ({ index }: { index: number }) => h('span', String(index)) }));
        expect(onHeight).toHaveBeenLastCalledWith(2000);
        estimatedHeight.value = 30;
        await flushRender();
        instance.value!.invalidatePositions();
        await flushRender();
        expect(onHeight).toHaveBeenLastCalledWith(2950);
        expect(container.querySelectorAll('span')).toHaveLength(5);
    });

    it('renders safely without a default slot', () => {
        const { container } = mount(() => h(VirtualList, {
            count: 2,
            virtual: false,
            itemElementCreatorFn: createItem,
        }));
        expect(container.firstElementChild!.children).toHaveLength(2);
        expect(container.textContent).toBe('');
    });

    it.each([false, true])('unmounts slot components and cancels pending rendering (virtual=%s)', async virtual => {
        const visible = ref(true);
        const count = ref(2);
        const onUnmount = vi.fn();
        const Child = defineComponent({
            unmounted: onUnmount,
            render: () => h('span', 'child'),
        });
        const { container } = mount(() => visible.value ? h(VirtualList, {
            count: count.value,
            virtual,
            style: listStyle,
            itemElementCreatorFn: createItem,
        }, { default: () => h(Child) }) : h('p', 'removed'));
        count.value = 4;
        visible.value = false;
        await flushRender();
        expect(container.textContent).toBe('removed');
        expect(onUnmount).toHaveBeenCalledTimes(2);
    });
});
