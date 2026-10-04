import VirtualListHelper from '../../lib/index.js';
import type {
    ItemElementCreatorFunction,
    ItemHeightEstimatorFunction,
    ItemRenderFunction,
    ItemUnrenderFunction,
    ScrollHeightChangeFunction,
    VirtualListHelperOptions,
} from '../../lib/index.js';
import { VirtualList } from '../../vue/index.js';

// Type-only assertions validate the published declarations, not the implementation source.
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type WrapperWidthResult = Assert<Equal<ReturnType<VirtualListHelper['isAutoVirtualWrapperWidth']>, boolean>>;
type PositionResult = Assert<Equal<ReturnType<VirtualListHelper['getItemPosition']>, number | undefined>>;
type ElementResult = Assert<Equal<ReturnType<VirtualListHelper['getItemElementAt']>, Element | undefined>>;
type SizeResult = Assert<Equal<ReturnType<VirtualListHelper['getItemSize']>, number | undefined>>;
type IndexResult = Assert<Equal<ReturnType<VirtualListHelper['getItemIndexFromElement']>, number | undefined>>;
type Estimator = Assert<Equal<ItemHeightEstimatorFunction, (index: number) => number | undefined>>;
type Creator = Assert<Equal<ItemElementCreatorFunction, () => Element>>;
type Renderer = Assert<Equal<ItemRenderFunction, (itemEl: Element, index: number) => void>>;
type Unrenderer = Assert<Equal<ItemUnrenderFunction, (itemEl: Element) => void>>;
type HeightCallback = Assert<Equal<ScrollHeightChangeFunction, (height: number) => void>>;

const options: VirtualListHelperOptions = {
    list: document.createElement('div'),
    itemsParent: null,
    virtual: true,
    hookScrollEvent: false,
    autoVirtualWrapperWidth: true,
    count: 100,
    estimatedItemHeight: 25,
    buffer: 3,
    itemHeightEstimatorFn: index => index === 0 ? 30 : undefined,
    itemElementCreatorFn: () => document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    onItemRender: (element, index) => { element.textContent = String(index); },
    onItemUnrender: element => { element.textContent = ''; },
    onScrollHeightChange: height => { height.toFixed(); },
};
const helper = new VirtualListHelper(options);
const chained: VirtualListHelper = helper.setCount(5).setVirtual().setHookScrollEvent().setAutoVirtualWrapperWidth()
    .setItemHeightEstimatorFn(null).setItemElementCreatorFn(null).setOnItemRender(null)
    .setOnItemUnrender(null).setOnScrollHeightChange(null).invalidatePositions().invalidate();
helper.createGhostItemElement('measurement', false, element => element.getBoundingClientRect());

// @ts-expect-error The list element is required.
new VirtualListHelper({ count: 10 });
// @ts-expect-error Counts must be numeric.
helper.setCount('10');
// @ts-expect-error Height estimators cannot return strings.
helper.setItemHeightEstimatorFn(() => '20');
// @ts-expect-error Item creators must return elements.
helper.setItemElementCreatorFn(() => 20);
// @ts-expect-error Render callbacks receive an Element and a numeric index.
helper.setOnItemRender((element: string, index: string) => {});
// @ts-expect-error Internal state is private.
helper._p;

const component: InstanceType<typeof VirtualList> = {} as InstanceType<typeof VirtualList>;
component.$emit('scrollHeightChange', 200);
// @ts-expect-error Only the declared event is accepted.
component.$emit('unknownEvent', 200);
component.invalidate();
component.invalidatePositions();
const props: InstanceType<typeof VirtualList>['$props'] = {
    count: 10,
    virtual: false,
    itemHeightEstimatorFn: index => index + 20,
    itemElementCreatorFn: () => document.createElement('div'),
};
// @ts-expect-error Vue item creators must return elements too.
const invalidProps: InstanceType<typeof VirtualList>['$props'] = { itemElementCreatorFn: () => 'div' };
