<template>
  <component
    :is="tag"
    ref="rootEl"
    v-bind="$attrs"
  />
</template>

<script>
import { defineComponent, ref, onMounted, onBeforeUnmount, render, createVNode, markRaw, nextTick, watch } from 'vue';
import VirtualListHelper from '../lib/index.js';

const VueInstanceSymbol = Symbol('vue_instance');

export default defineComponent({
    name: 'VirtualList',

    props: {
        tag: { type: String, default: 'div' },
        count: { type: Number, default: 0 },
        items: { type: Array, default: null },
        autoVirtualWrapperWidth: { type: Boolean, default: true },
        hookScrollEvent: { type: Boolean, default: true },
        virtual: { type: Boolean, default: true },
        estimatedItemHeight: { type: Number, default: 20 },
        buffer: { type: Number, default: 5 },
        itemHeightEstimatorFn: { type: Function, default: null },
        itemElementCreatorFn: { type: Function, default: null },
    },

    emits: ['scrollHeightChange'],

    setup(props, { slots, attrs, emit }) {
        const rootEl = ref(null);
        let helper = null;
        let isRenderScheduled = false;
        let isInvalidateScheduled = false;

        // --- Rendering individual list items ---
        const onItemRender = (el, index) => {
            const data = { index: index };
            if (props.items) {
                data.item = props.items[index];
            }

            let vnode = el[VueInstanceSymbol];
            if (!vnode) {
                let slotVnode = slots.default(data);
                vnode = createVNode({
                    render() {
                        return slotVnode;
                    },
                });
                el[VueInstanceSymbol] = vnode;
            }

            render(vnode, el);
        };

        const onItemUnrender = (el) => {
            const app = el[VueInstanceSymbol];
            if (!app) return;
            render(null, el);
        };

        // --- Scheduling helpers ---
        const scheduleInvalidate = () => {
            if (isInvalidateScheduled) return;
            isInvalidateScheduled = true;
            nextTick(() => {
                isInvalidateScheduled = false;
                helper?.invalidate();
            });
        };

        const scheduleRender = () => {
            if (isRenderScheduled) return;
            isRenderScheduled = true;
            nextTick(() => {
                isRenderScheduled = false;
                helper?.render();
            });
        };

        // --- Lifecycle hooks ---
        onMounted(() => {
            if (!rootEl.value) return;

            helper = markRaw(new VirtualListHelper({
                list: rootEl.value,
                count: props.items ? props.items.length : props.count,
                autoVirtualWrapperWidth: props.autoVirtualWrapperWidth,
                //hookScrollEvent: props.hookScrollEvent,
                virtual: props.virtual,
                estimatedItemHeight: props.estimatedItemHeight,
                buffer: props.buffer,
                itemHeightEstimatorFn: props.itemHeightEstimatorFn,
                itemElementCreatorFn: props.itemElementCreatorFn,
                onScrollHeightChange: height => emit('scrollHeightChange', height),

                onItemRender: onItemRender,
                onItemUnrender: onItemUnrender,
            }));

            helper.render();
        });

        onBeforeUnmount(() => {
            helper?.destroy?.();
            helper = null;
        });

        // --- Reactive watchers (Composition API style) ---
        watch(
            () => props.count,
            (v) => {
                helper?.setCount(props.items ? props.items.length : v);
                scheduleRender();
            },
        );

        watch(
            () => props.items,
            (v) => {
                helper?.setCount(v ? v.length : props.count);
                scheduleRender();
            },
        );

        watch(() => props.autoVirtualWrapperWidth, (v) => {
            helper?.setAutoVirtualWrapperWidth(v);
        });

        watch(() => props.hookScrollEvent, (v) => {
            helper?.setHookScrollEvent(v);
        });

        watch(() => props.virtual, (v) => {
            helper?.setVirtual(v);
            scheduleRender();
        });

        watch(() => props.estimatedItemHeight, (v) => {
            helper?.setEstimatedItemHeight(v);
            scheduleInvalidate();
        });

        watch(() => props.buffer, (v) => {
            helper?.setBuffer(v);
        });

        watch(() => props.itemHeightEstimatorFn, (v) => {
            helper?.setItemHeightEstimatorFn(v);
            scheduleInvalidate();
        });

        watch(() => props.itemElementCreatorFn, (v) => {
            helper?.setItemElementCreatorFn(v);
            scheduleInvalidate();
        });

        // --- Public API (replacing methods) ---
        const invalidate = () => {
            helper?.invalidate();
            scheduleRender();
        };

        const invalidatePositions = () => {
            helper?.invalidatePositions();
            scheduleRender();
        };

        return {
            rootEl,
            attrs,
            invalidate,
            invalidatePositions,
        };
    },
});
</script>
