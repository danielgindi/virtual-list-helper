import { getElementOffset } from '@danielgindi/dom-utils/lib/Css.js';

/**
 * @typedef {function(index: number):(number|undefined)} VirtualListHelper~ItemHeightEstimatorFunction
 */

/**
 * @typedef {function():Element} VirtualListHelper~ItemElementCreatorFunction
 */

/**
 * @typedef {function(itemEl: Element, index: number)} VirtualListHelper~ItemRenderFunction
 */

/**
 * @typedef {function(itemEl: Element)} VirtualListHelper~ItemUnrenderFunction
 */

/**
 * @typedef {Object} VirtualListHelper~Options
 * @property {Element} list - the main element to operate inside of
 * @property {Element?} [itemsParent] - the element to use as parent for the items (automatically created in virtual mode, uses parent by default in non-virtual mode)
 * @property {boolean} [autoVirtualWrapperWidth=true] automatically set the width of the virtual wrapper
 * @property {boolean} [hookScrollEvent=true] automatically hook scroll event as needed
 * @property {number} [count=0] the item count
 * @property {boolean} [virtual=true] is virtual mode on?
 * @property {number} [estimatedItemHeight=20] estimated item height
 * @property {number} [buffer=5] the amount of buffer items to keep on each end of the list
 * @property {VirtualListHelper~ItemHeightEstimatorFunction} [itemHeightEstimatorFn] an optional function for providing item height estimations
 * @property {VirtualListHelper~ItemElementCreatorFunction} [itemElementCreatorFn] an optional function for providing fresh item elements (default creates `<li />`s)
 * @property {VirtualListHelper~ItemRenderFunction} [onItemRender] a function for rendering element content based on item index
 * @property {VirtualListHelper~ItemUnrenderFunction} [onItemUnrender] a function for freeing resources in an item element
 * @property {function(height: number)} [onScrollHeightChange] a function to be notified when scroll height changes
 *
 */

/** */

const hasOwnProperty = Object.prototype.hasOwnProperty;

const hasInsertAdjacentElement = Element.prototype.insertAdjacentElement !== undefined;

function insertBefore(el, before, parent) {
  if (!before)
    parent.appendChild(el);
  else if (hasInsertAdjacentElement === false || el instanceof DocumentFragment)
    parent.insertBefore(el, before);
  else before.insertAdjacentElement('beforebegin', el);
}

/**
 *
 * @param {Element} itemEl
 * @param {DocumentFragment|null} fragment
 * @param {Node|undefined} before
 * @param {Element} itemParent
 * @returns {DocumentFragment|null}
 */
function insertBeforeWithFragment(itemEl, fragment, before, itemParent) {
  if (itemEl.parentNode !== itemParent) {
    if (!fragment)
      fragment = document.createDocumentFragment();
    fragment.appendChild(itemEl);
  } else {
    // insert fragment
    if (fragment && fragment.childNodes.length > 0) {
      insertBefore(fragment, before, itemParent);
      fragment = null;
    }

    // insert element
    if (itemEl.nextSibling !== before) {
      insertBefore(itemEl, before, itemParent);
    }
  }

  return fragment;
}

class VirtualListHelper {
  /**
   * @param {VirtualListHelper~Options} opts
   */
  constructor(opts) {
    /** @private */
    const p = this._p = {
      // these come from options:

      list: opts.list || null,
      hookScrollEvent: opts.hookScrollEvent === undefined ? true : !!opts.hookScrollEvent,
      count: opts.count || 0,
      virtual: opts.virtual === undefined ? true : !!opts.virtual,
      userItemsParent: opts.itemsParent || null,
      setVirtualWrapperWidth: opts.autoVirtualWrapperWidth ?? true,
      estimatedItemHeight: 20,
      buffer: 5,

      /** @type VirtualListHelper~ItemHeightEstimatorFunction|null */
      itemHeightEstimatorFn: null,

      /** @type VirtualListHelper~ItemElementCreatorFunction|null */
      itemElementCreatorFn: defaultElementCreator,

      /** @type VirtualListHelper~ItemRenderFunction|null */
      onItemRender: null,

      /** @type VirtualListHelper~ItemUnrenderFunction|null */
      onItemUnrender: null,

      /** @type funct(height: number)|null */
      onScrollHeightChange: null,

      // internal:

      /** @type Element|null */
      virtualWrapper: null,

      /** @type Element|null */
      currentItemsParent: null,

      /** @type (number|undefined)[] */
      cachedItemHeights: [],

      /** @type (number|undefined)[] */
      cachedItemEstimatedHeights: [],

      /** @type (number|undefined)[] */
      cachedItemPositions: [],

      /** @type number */
      itemPositionsNeedsUpdate: 0,

      /** @type function */
      boundRender: this.render.bind(this),

      /** @type Element[] */
      existingEls: [],
    };

    p.currentItemsParent = p.userItemsParent || p.list;

    if (typeof opts.hookScrollEvent === 'boolean')
      this.setHookScrollEvent(opts.hookScrollEvent);
    else this._hookEvents();

    if (typeof opts.count === 'number')
      this.setCount(opts.count);

    if (typeof opts.virtual === 'boolean')
      this.setVirtual(opts.virtual);

    if (typeof opts.estimatedItemHeight === 'number')
      this.setEstimatedItemHeight(opts.estimatedItemHeight);

    if (typeof opts.buffer === 'number')
      this.setBuffer(opts.buffer);

    if (typeof opts.itemHeightEstimatorFn === 'function')
      this.setItemHeightEstimatorFn(opts.itemHeightEstimatorFn);

    if (typeof opts.itemElementCreatorFn === 'function')
      this.setItemElementCreatorFn(opts.itemElementCreatorFn);

    if (typeof opts.onItemRender === 'function')
      this.setOnItemRender(opts.onItemRender);

    if (typeof opts.onItemUnrender === 'function')
      this.setOnItemUnrender(opts.onItemUnrender);

    if (typeof opts.onScrollHeightChange === 'function')
      this.setOnScrollHeightChange(opts.onScrollHeightChange);
  }

  /**
   * Clean up and free up all resources.
   */
  destroy() {
    this._unhookEvents().invalidate()._destroyElements();
  }

  /**
   * Sets whether 'scroll' event on the list should be hooked automatically.
   * @param {boolean} enabled
   * @returns {VirtualListHelper}
   */
  setHookScrollEvent(enabled) {
    const p = this._p;
    enabled = enabled === undefined ? true : !!enabled;

    if (p.hookScrollEvent === enabled)
      return this;

    p.hookScrollEvent = enabled;

    this._unhookEvents()._hookEvents();

    return this;
  }

  /**
   * @returns {boolean} whether 'scroll' event on the list should be hooked automatically
   */
  isHookScrollEventEnabled() {
    const p = this._p;
    return p.hookScrollEvent;
  }

  /**
   * Sets the list item count. <br />
   * You should probably call `render()` after this.
   * @param {number} count
   * @returns {VirtualListHelper}
   */
  setCount(count) {
    const p = this._p;
    p.count = count;

    return this.invalidate();
  }

  /**
   * @returns {number} current item count
   */
  getCount() {
    const p = this._p;
    return p.count;
  }

  /**
   * Switches between virtual and non-virtual mode. <br />
   * The list is invalidated automatically. <br />
   * You should call `render()` to update the view.
   * @param {boolean} enabled
   * @returns {VirtualListHelper}
   */
  setVirtual(enabled) {
    const p = this._p;
    enabled = enabled === undefined ? true : !!enabled;

    if (p.virtual === enabled)
      return this;

    p.virtual = enabled;

    this._hookEvents().invalidate()._destroyElements();

    return this;
  }

  /**
   * @returns {boolean} virtual mode
   */
  isVirtual() {
    const p = this._p;
    return p.virtual;
  }

  /**
   * Sets estimated item height. <br />
   * No need to be accurate. <br />
   * The better the estimation - the better the scrollbar behavior will be. <br />
   * Applicable for virtual-mode only. <br />
   * You should `invalidate` if you want this to take effect on the existing rendering.
   * @param {number} height - a positive number representing estimated item height.
   * @returns {VirtualListHelper}
   */
  setEstimatedItemHeight(height) {
    const p = this._p;
    p.estimatedItemHeight = Math.abs((typeof height === 'number' ? height : Number(height)) || 20);
    return this;
  }

  /**
   * @returns {number} current item height estimation
   */
  getEstimatedItemHeight() {
    const p = this._p;
    return p.estimatedItemHeight;
  }

  /**
   * Sets whether the virtual wrapper width should be set automatically. <br />
   * @param {boolean} enabled
   * @returns {VirtualListHelper}
   */
  setAutoVirtualWrapperWidth(enabled) {
    const p = this._p;
    p.autoVirtualWrapperWidth = enabled === undefined ? true : !!enabled;

    if (p.virtualWrapper) {
      if (p.autoVirtualWrapperWidth !== p.virtualWrapperWidthWasSet) {
        p.virtualWrapper.style.width = p.autoVirtualWrapperWidth ? '100%' : '';
        p.virtualWrapperWidthWasSet = p.autoVirtualWrapperWidth;
      }
    }

    return this;
  }

  /**
   * @returns {boolean} whether the virtual wrapper width should be set automatically
   */
  isAutoVirtualWrapperWidth() {
    const p = this._p;
    return p.autoVirtualWrapperWidth;
  }

  /**
   * Sets the amount of buffer items to keep on each end of the list. <br />
   * Applicable for virtual-mode only.
   * @param {number} buffer - a positive value representing the count of buffer items for each end.
   * @returns {VirtualListHelper}
   */
  setBuffer(buffer) {
    const p = this._p;
    p.buffer = Math.abs(typeof buffer === 'number' ? buffer : (Number(buffer) || 5));
    return this;
  }

  /**
   * @returns {number} current buffer value
   */
  getBuffer() {
    const p = this._p;
    return p.buffer;
  }

  /**
   * The `itemHeightEstimatorFn` is an alternative to `estimatedItemHeight` to give better estimations for specific item. <br/>
   * It's optional, and if it's present - it should return either a numeric height estimation,
   *   or `undefined` to fall back to the default estimation. <br />
   * You should `invalidate` if you want this to take effect on the existing rendering.
   * @param {VirtualListHelper~ItemHeightEstimatorFunction} fn
   * @returns {VirtualListHelper}
   */
  setItemHeightEstimatorFn(fn) {
    const p = this._p;
    p.itemHeightEstimatorFn = fn;
    return this;
  }

  /**
   * The `itemElementCreatorFn` is a function creating a basic item element, that will be possibly reused later. <br />
   * It has no association with a specific item index. <br />
   * You should `invalidate` if you want this to take effect on the existing rendering.
   * @param {VirtualListHelper~ItemElementCreatorFunction} fn
   * @returns {VirtualListHelper}
   */
  setItemElementCreatorFn(fn) {
    const p = this._p;
    p.itemElementCreatorFn = fn || defaultElementCreator;
    return this;
  }

  /**
   * The `onItemRender` is a function called for rendering the contents of an item. <br />
   * It's passed an `Element` and an item index. <br />
   * You should `invalidate` if you want this to take effect on the existing rendering.
   * @param {VirtualListHelper~ItemRenderFunction} fn
   * @returns {VirtualListHelper}
   */
  setOnItemRender(fn) {
    const p = this._p;
    p.onItemRender = fn;
    return this;
  }

  /**
   * The `onItemUnrender` is a function called for freeing resources in an item element,
   *   if you've attached something that needs to be explicitly freed. <br />
   * It's passed an `Element` only, and has no association with a specific index,
   *   as by the time it's called - the indexes are probably not valid anymore.
   * @param {VirtualListHelper~ItemUnrenderFunction} fn
   * @returns {VirtualListHelper}
   */
  setOnItemUnrender(fn) {
    const p = this._p;
    p.onItemUnrender = fn;
    return this;
  }

  /**
   * The `onScrollHeightChange` is a function called when the scroll height changes.
   * @param {function(height: number)} fn
   * @returns {VirtualListHelper}
   */
  setOnScrollHeightChange(fn) {
    const p = this._p;
    p.onScrollHeightChange = fn;
    return this;
  }

  /**
   * Estimates the full scroll height. This gets better as more renderings occur.
   * @returns {number}
   */
  estimateFullHeight() {
    const p = this._p;

    if (p.count === 0)
      return 0;

    if (p.virtual) {
      return this._calculateItemPosition(p.count) || 0;
    } else {
      const existingEls = p.existingEls;
      if (p.count === existingEls.length) {
        let rect1 = existingEls[0].getBoundingClientRect();
        let rect2 = existingEls[existingEls.length - 1].getBoundingClientRect();
        return rect2.top - rect1.top + rect2.height;
      }

      return this._calculateItemPosition(p.count) || 0;
    }
  }

  /**
   * States that the cached positions/heights are invalid,
   *   and needs to be completely re-calculated.<br />
   * You should probably call `render()` after this.
   * @returns {VirtualListHelper}
   */
  invalidatePositions() {
    const p = this._p;

    p.itemPositionsNeedsUpdate = 0;
    p.cachedItemHeights = [];
    p.cachedItemEstimatedHeights = [];
    p.cachedItemPositions = [];
    p.cachedItemHeights.length = p.count;
    p.cachedItemEstimatedHeights.length = p.count;
    p.cachedItemPositions.length = p.count;

    return this;
  }

  /**
   * States that the indexes/item count/rendered content are invalid,
   *   and needs to be completely re-calculated and re-rendered. <br />
   * You should probably call `render()` after this.
   * @returns {VirtualListHelper}
   */
  invalidate() {
    const p = this._p;

    this.invalidatePositions();

    if (!p.virtual) {
      this._destroyElements();
    }

    return this;
  }

  /**
   * Renders the current viewport. <br />
   * Call this after making changes to the list. <br />
   * In virtual mode, this is called automatically for every scroll event.
   */
  render() {
    const p = this._p;
    const list = p.list;
    const virtual = p.virtual;
    let virtualWrapper = p.virtualWrapper;
    let itemParent = p.currentItemsParent;
    let scrollTop = list.scrollTop;
    let visibleHeight = list.clientHeight;
    let visibleBottom = scrollTop + visibleHeight;
    let count = p.count;
    let buffer = p.buffer;
    let onItemUnrender = p.onItemUnrender;
    let existingEls = p.existingEls;
    let existingCount = existingEls.length;

    if (virtual) {
      const originalWidth = list.clientWidth;

      if (!virtualWrapper) {
        virtualWrapper = p.virtualWrapper = p.userItemsParent;
        if (!virtualWrapper) {
          virtualWrapper = p.virtualWrapper = document.createElement('div');
          list.appendChild(virtualWrapper);
        }

        this._resetCurrentItemsParent();
        itemParent = p.currentItemsParent;

        if (p.autoVirtualWrapperWidth) {
          virtualWrapper.style.width = '100%';
          p.virtualWrapperWidthWasSet = true;
        } else {
          p.virtualWrapperWidthWasSet = false;
        }
      }

      // Mark all of them for potential reuse
      for (let i = 0; i < existingCount; i++) {
        existingEls[i][ReuseElSymbol] = true;
      }

      // Make sure we have at least estimated positions for all items so we can translate scroll position
      this._calculateItemPosition(p.count - 1);

      // Find existing elements index range
      let existingRange = this._getExistingElsRange();

      // Find first visible element
      let firstVisibleIndex = binarySearchPosition(p.cachedItemPositions, scrollTop);
      let firstRenderIndex = Math.max(0, firstVisibleIndex - buffer);

      // Iterate over viewport
      let index = firstRenderIndex;
      let renderPos = this._calculateItemPosition(index);
      let bufferEnd = buffer;

      // we want to render until viewport's bottom + buffer items
      let maxIndexToRender = Math.max(index, binarySearchPosition(p.cachedItemPositions, visibleBottom - 1) + 1 + buffer);

      let insertedItems = [];

      /** @type DocumentFragment|null */
      let fragment = null;

      // Find the element to insert before
      let before = virtualWrapper.childNodes[0];

      const findElementToReuse = function (index) {
        // Find existing element to reuse
        /** @type Element|undefined */
        let existingEl = undefined;

        if (existingRange.firstIndex !== -1 && index >= existingRange.firstIndex && index <= existingRange.lastIndex) {
          existingEl = existingEls.find(x => x[ItemIndexSymbol] === index && x[ReuseElSymbol] === true);
        }

        if (existingEl === undefined) {
          existingEl = ((existingRange.firstIndex < firstRenderIndex || existingRange.firstValidArrayIndex > 0)
                  ? existingEls.find((x) =>
                      (x[ItemIndexSymbol] < firstRenderIndex || false === hasOwnProperty.call(x, ItemIndexSymbol))
                      && x[ReuseElSymbol] === true)
                  : undefined
          ) || findLast(existingEls, (x) => x[ReuseElSymbol] === true);
        }

        if (existingEl !== undefined) {
          delete existingEl[ReuseElSymbol];
        }

        return existingEl;
      };

      // First we iterate and try to add all at once in a fragment, as much as we can.
      // And then reflow the at once.
      for (; index < count && index < maxIndexToRender; index++) {
        let existingEl = findElementToReuse(index);

        if (before && before === existingEl)
          before = before.nextSibling;

        // Dequeue the element by reusing or creating a new one
        const itemEl = this._dequeueElementForIndex(existingEl, index, before, true);
        insertedItems.push([itemEl, index]);

        fragment = insertBeforeWithFragment(itemEl, fragment, before, itemParent);
      }

      // Insert any remaining fragment
      if (fragment && fragment.childNodes.length > 0) {
        insertBefore(fragment, before, itemParent);
      }

      // Iterate on inserted items and reflow them
      for (let item of insertedItems) {
        const index = item[1];
        this._insertItemAndFlow(item[0], index, false /* inserted already */);
        renderPos = p.cachedItemPositions[index] + p.cachedItemHeights[index];
      }

      // See if we still need to insert more items
      if (renderPos < visibleBottom) {
        for (; (renderPos < visibleBottom || bufferEnd-- > 0) && index < count; index++) {
          let existingEl = findElementToReuse(index);

          if (before && before === existingEl)
            before = before.nextSibling;

          // Dequeue the element by reusing or creating a new one
          this._dequeueElementForIndex(existingEl, index, before, false);

          // Increment pointers
          renderPos = p.cachedItemPositions[index] + p.cachedItemHeights[index];
        }
      }

      // Calculate up-to-date scroll height
      let scrollHeight = this.estimateFullHeight();
      let scrollHeightPx = scrollHeight + 'px';

      if (virtualWrapper.style.height !== scrollHeightPx) {
        p.virtualWrapper.style.height = scrollHeightPx;
        p.onScrollHeightChange?.(scrollHeight);
      }

      if (originalWidth !== list.clientWidth)
        this.render();
    } else { // non-virtual
      if (count !== existingEls.length) {
        for (let i = 0; i < existingCount; i++) {
          existingEls[i][ReuseElSymbol] = true;
        }

        // Find the element to insert before
        let before = itemParent.childNodes[0];

        /** @type DocumentFragment|null */
        let fragment = null;

        for (let index = 0; index < count; index++) {
          // Find existing element to reuse
          let existingEl = existingEls.find(x => x[ItemIndexSymbol] === index && x[ReuseElSymbol] === true);

          if (existingEl !== undefined) {
            delete existingEl[ReuseElSymbol];
          }

          if (before && before === existingEl)
            before = before.nextSibling;

          // Dequeue the element by reusing or creating a new one
          const itemEl = this._dequeueElementForIndex(existingEl, index, before, true);

          fragment = insertBeforeWithFragment(itemEl, fragment, before, itemParent);
        }

        // Insert any remaining fragment
        if (fragment && fragment.childNodes.length > 0) {
          insertBefore(fragment, before, itemParent);
        }
      }
    }

    // Cleanup extra unused elements
    existingCount = existingEls.length; // May have changed
    for (let i = 0; i < existingCount; i++) {
      const el = existingEls[i];
      if (el[ReuseElSymbol] !== true) continue;

      let parent = el.parentNode;
      if (parent)
        parent.removeChild(el);
      if (onItemUnrender && el[ItemIndexSymbol] !== undefined)
        onItemUnrender(el);
      existingEls.splice(i, 1);

      i--;
      existingCount--;
    }
  }

  /**
   * States that items were added at a certain position in the list. <br />
   * Virtual mode: Call `render()` to update the view after making changes.
   * @param {number} count
   * @param {number} [atIndex=-1]
   * @returns {VirtualListHelper}
   */
  addItemsAt(count, atIndex = -1) {
    if (typeof count !== 'number' || count <= 0)
      return this;

    const p = this._p;

    if (atIndex < 0 || atIndex >= p.count)
      atIndex = p.count;

    p.count += count;

    if (p.virtual) {
      if (atIndex >= 0 && atIndex < p.count) {
        this._invalidateItemIndexesAt(atIndex, -1);
      }
    }
    else { // non-virtual
      let existingEls = p.existingEls;
      let existingCount = existingEls.length;
      if (existingCount !== p.count - count)
        return this;

      let existingRange = this._getExistingElsRange();
      if (existingRange.firstValidArrayIndex === -1)
        return this;

      const itemParent = p.currentItemsParent;

      let startIndex = existingRange.firstValidArrayIndex + atIndex - existingRange.firstIndex;

      this._pushItemIndexesAt(atIndex, count);

      /** @type Node|undefined */
      let before = existingEls[startIndex - 1]
          ? existingEls[startIndex - 1].nextSibling
          : existingEls[0];

      /** @type DocumentFragment|null */
      let fragment = null;

      for (let index = atIndex, end = atIndex + count; index < end; index++) {
        const itemEl = this._dequeueElementForIndex(undefined, index, before, true);
        fragment = insertBeforeWithFragment(itemEl, fragment, before, itemParent);
      }

      // Insert any remaining fragment
      if (fragment && fragment.childNodes.length > 0) {
        insertBefore(fragment, before, itemParent);
      }
    }

    return this;
  }

  /**
   * States that items were removed at a certain position in the list. <br />
   * Virtual mode: Call `render()` to update the view after making changes.
   * @param {number} count
   * @param {number} atIndex
   * @returns {VirtualListHelper}
   */
  removeItemsAt(count, atIndex) {
    const p = this._p;

    if (typeof count !== 'number' || typeof atIndex !== 'number' || count <= 0 || atIndex < 0 || atIndex >= p.count)
      return this;

    p.count -= Math.min(count, p.count - atIndex);

    if (p.virtual) {
      this._invalidateItemIndexesAt(atIndex, -1);
    }
    else { // non-virtual
      let existingEls = p.existingEls;
      let existingCount = existingEls.length;
      if (existingCount !== p.count + count)
        return this;

      let existingRange = this._getExistingElsRange();
      if (existingRange.firstValidArrayIndex === -1)
        return this;

      this._pushItemIndexesAt(atIndex + count, -count);

      const onItemUnrender = p.onItemUnrender;
      let index = existingRange.firstValidArrayIndex + atIndex - existingRange.firstIndex;
      if (index < existingEls.length) {
        for (let i = 0; i < count; i++) {
          let itemEl = existingEls[index + i];

          let parent = itemEl.parentNode;
          if (parent)
            parent.removeChild(itemEl);
          if (onItemUnrender && itemEl[ItemIndexSymbol] !== undefined)
            onItemUnrender(itemEl);
        }
        existingEls.splice(index, count);
      }
    }

    return this;
  }

  /**
   * Mark an element for a re-render. <br />
   * Virtual mode: Call `render()` to update the view after making changes. <br />
   * Non-virtual mode - the element is re-rendered immediately.
   * @param {number} index - the index of the element to re-render
   * @returns {VirtualListHelper}
   */
  refreshItemAt(index) {
    const p = this._p;

    if (typeof index !== 'number' || index < 0 || index >= p.count)
      return this;

    if (p.virtual) {
      this._invalidateItemIndexesAt(index, 1);
    }
    else { // non-virtual
      let existingEls = p.existingEls;
      let existingCount = existingEls.length;
      if (existingCount !== p.count)
        return this;

      let existingRange = this._getExistingElsRange();

      if (index >= existingRange.firstIndex && index <= existingRange.lastIndex) {
        let itemEl = existingEls[existingRange.firstValidArrayIndex + index - existingRange.firstIndex];
        delete itemEl[ItemIndexSymbol];
        this._dequeueElementForIndex(itemEl, index, itemEl.nextSibling, false);
      }
    }

    return this;
  }

  /**
   * Tests whether an item at the specified index is rendered.
   * @param {number} index - the index to test
   * @returns {boolean}
   */
  isItemRendered(index) {
    const p = this._p;

    if (typeof index !== 'number' || index < 0 || index >= p.count)
      return false;

    let existingRange = this._getExistingElsRange();

    return index >= existingRange.firstIndex && index <= existingRange.lastIndex;
  }

  /**
   * Retrieves DOM element for the item at the specified index - if it's currently rendered.
   * @param {number} index - the index to retrieve
   * @returns {Element|undefined}
   */
  getItemElementAt(index) {
    const p = this._p;

    if (typeof index !== 'number' || index < 0 || index >= p.count)
      return undefined;

    let existingEls = p.existingEls;
    let existingRange = this._getExistingElsRange();

    if (index >= existingRange.firstIndex && index <= existingRange.lastIndex) {
      return existingEls[existingRange.firstValidArrayIndex + index - existingRange.firstIndex];
    }

    return undefined;
  }

  /**
   * Retrieves the position for the specified index. <br />
   * Can be used to scroll to a specific item.
   * @param {number} index
   * @returns {number|undefined}
   */
  getItemPosition(index) {
    const p = this._p;

    if (typeof index !== 'number' || index < 0 || index >= p.count)
      return undefined;

    if (p.virtual) {
      return this._calculateItemPosition(index);
    } else {
      let itemEl = this.getItemElementAt(index);
      if (itemEl === undefined)
        return undefined;

      const list = p.list;
      return getElementOffset(itemEl).top - getElementOffset(list).top + list.scrollTop;
    }
  }

  /**
   * Retrieves the item index for the specified element
   * @param {Element} el
   * @returns {number|undefined}
   */
  getItemIndexFromElement(el) {
    return el ? el[ItemIndexSymbol] : undefined;
  }

  /**
   * Retrieves the size (or estimated size, if unknown) for the specified index. <br />
   * @param {number} index
   * @returns {number|undefined}
   */
  getItemSize(index) {
    const p = this._p;

    if (typeof index !== 'number' || index < 0 || index >= p.count)
      return undefined;

    let height = p.cachedItemHeights[index - 1]; // already calculated

    if (height === undefined) {
      height = p.itemHeightEstimatorFn ? p.itemHeightEstimatorFn(index - 1) : null; // estimated per item

      if (typeof height !== 'number')
        height = p.estimatedItemHeight; // estimated

      p.cachedItemEstimatedHeights[index - 1] = height;
    }

    return height;
  }

  /**
   * Retrieves the number of items that fit into the current viewport.
   * @returns {number}
   */
  getVisibleItemCount() {
    const p = this._p, list = p.list;

    let scrollTop = list.scrollTop;
    let visibleHeight = list.clientHeight;
    let firstVisibleIndex, lastVisibleIndex;

    if (p.virtual) {
      firstVisibleIndex = binarySearchPosition(p.cachedItemPositions, scrollTop);
      lastVisibleIndex = binarySearchPosition(p.cachedItemPositions, scrollTop + visibleHeight, firstVisibleIndex);
    }
    else {
      const retriever = i => {
        let pos = this.getItemPosition(i);
        if (pos === undefined)
          pos = Infinity;
        return pos;
      };

      firstVisibleIndex = binarySearchPositionByFn(p.count, retriever, scrollTop);
      lastVisibleIndex = binarySearchPositionByFn(p.count, retriever, scrollTop + visibleHeight, firstVisibleIndex);
    }

    if (this.getItemPosition(lastVisibleIndex) === scrollTop + visibleHeight)
      lastVisibleIndex--;
    return (lastVisibleIndex - firstVisibleIndex) + 1;
  }

  /**
   * Renders a temporary ghost item. Can be used for testings several aspects of a proposed element, i.e measurements.
   * @param {*} ghostIndex - the value to pass as the index for the renderer function
   * @param {boolean} append - whether to append the item element to the DOM
   * @param {function(itemEl: Element)} ghostTester - the function that will receive the element, called synchronously.
   */
  createGhostItemElement(ghostIndex, append, ghostTester) {
    const p = this._p;

    let itemEl = this._dequeueElementForIndex(null, ghostIndex, false, true);
    try {
      if (append) {
        p.currentItemsParent.appendChild(itemEl);
      }
      ghostTester(itemEl);
    } finally {
      if (append) {
        let parent = itemEl.parentNode;
        if (parent)
          parent.removeChild(itemEl);
      }
      if (p.onItemUnrender)
        p.onItemUnrender(itemEl);
    }
  }

  /**
   * Reset the pointer to the current items wrapper
   * @private
   */
  _resetCurrentItemsParent() {
    const p = this._p;
    p.currentItemsParent = p.virtualWrapper ?? p.userItemsParent ?? p.list;
  }

  /**
   * Destroy all created elements, for cleanup
   * @returns {VirtualListHelper}
   * @private
   */
  _destroyElements() {
    const p = this._p;
    const onItemUnrender = p.onItemUnrender;
    const existingEls = p.existingEls;

    for (let i = 0; i < existingEls.length; i++) {
      const el = existingEls[i];

      let parent = el.parentNode;
      if (parent)
        parent.removeChild(el);
      if (onItemUnrender && el[ItemIndexSymbol] !== undefined)
        onItemUnrender(el);
    }

    existingEls.length = 0;

    if (p.virtualWrapper) {
      if (p.virtualWrapper !== p.userItemsParent) {
        if (p.virtualWrapper.parentNode) {
          p.virtualWrapper.parentNode.removeChild(p.virtualWrapper);
        }
      }
      p.virtualWrapper = null;
      this._resetCurrentItemsParent();
    }

    return this;
  }

  /**
   * Marks (an) item(s) at specific index(es) as to be re-rendered. <br />
   * Applicable for virtual mode only.
   * @param {number} index
   * @param {number} count
   * @private
   */
  _invalidateItemIndexesAt(index, count) {
    const p = this._p;

    this._setItemPositionsNeedsUpdate(index);

    let existingEls = p.existingEls;
    let existingCount = existingEls.length;
    let existingRange = this._getExistingElsRange();

    if (existingRange.firstValidArrayIndex === -1)
      return;

    if (count === -1)
      count = existingEls.length;

    // Clean
    if (index >= existingRange.firstIndex && index <= existingRange.lastIndex) {
      for (let i = existingRange.firstValidArrayIndex + index - existingRange.firstIndex,
               c = 0;
           i < existingCount && c < count;
           i++, c++)
        delete existingEls[i][ItemIndexSymbol];
    }
  }

  /**
   * In/decrement the item-index marker for specific item(s). <br />
   * Used for inserting/removing items in the middle of the list, without re-rendering everything. <br />
   * Applicable for non-virtual mode only.
   * @param {number} index
   * @param {number} count
   * @private
   */
  _pushItemIndexesAt(index, count) {
    const p = this._p;

    let existingEls = p.existingEls;
    let existingCount = existingEls.length;
    let existingRange = this._getExistingElsRange();

    if (existingRange.firstValidArrayIndex === -1)
      return;

    // Clean
    if (index >= existingRange.firstIndex && index <= existingRange.lastIndex) {
      for (let i = existingRange.firstValidArrayIndex + index - existingRange.firstIndex;
           i < existingCount;
           i++)
        existingEls[i][ItemIndexSymbol] += count;
    }
  }

  /**
   * Hook relevant events
   * @returns {VirtualListHelper}
   * @private
   */
  _hookEvents() {
    const p = this._p;

    this._unhookEvents();

    if (p.virtual && p.hookScrollEvent) {
      p.list && p.list.addEventListener('scroll', /**@type Function*/p.boundRender);
    }

    return this;
  }

  /**
   * Unhook previously hooked events
   * @returns {VirtualListHelper}
   * @private
   */
  _unhookEvents() {
    const p = this._p;

    p.list && p.list.removeEventListener('scroll', /**@type Function*/p.boundRender);

    return this;
  }

  /**
   * Mark item index from which the positions are not considered valid anymore. <br />
   * Applicable for virtual mode only.
   * @param {number} value
   * @private
   */
  _setItemPositionsNeedsUpdate(value) {
    const p = this._p;

    if (value < p.itemPositionsNeedsUpdate) {
      p.itemPositionsNeedsUpdate = value;
    }
  }

  /**
   * Calculates an item's top position (and stores in the private `cachedItemPositions` array). <br />
   * Allows calculating last+1 index too, to get the bottom-most position. <br />
   * Applicable for non-virtual mode only.
   * @param {number} index
   * @returns {number|undefined}
   * @private
   */
  _calculateItemPosition(index) {
    const p = this._p;

    const cachedItemPositions = p.cachedItemPositions;

    if (index >= p.itemPositionsNeedsUpdate) {
      const count = p.count;
      const cachedItemHeights = p.cachedItemHeights;
      const cachedItemEstimatedHeights = p.cachedItemEstimatedHeights;
      const estimatedItemHeight = p.estimatedItemHeight;
      const itemHeightEstimatorFn = p.itemHeightEstimatorFn;

      if (cachedItemHeights.length !== count) {
        cachedItemHeights.length = count;
        cachedItemEstimatedHeights.length = count;
        cachedItemPositions.length = count;
      }

      let fromIndex = p.itemPositionsNeedsUpdate;
      let toIndex = Math.min(index, count);

      let pos = 0;

      if (fromIndex > 0) {
        pos = cachedItemPositions[fromIndex - 1];
      }

      for (let i = fromIndex; i <= toIndex; i++) {
        if (i === 0) {
          cachedItemPositions[i] = pos;
          continue;
        }

        const prevIndex = i - 1;

        let height = cachedItemHeights[prevIndex]; // already calculated

        if (height === undefined) {
          height = itemHeightEstimatorFn ? itemHeightEstimatorFn(prevIndex) : null; // estimated per item

          if (typeof height !== 'number')
            height = estimatedItemHeight; // estimated

          cachedItemEstimatedHeights[prevIndex] = height;
        }

        pos += height;
        cachedItemPositions[i] = pos;
      }

      p.itemPositionsNeedsUpdate = toIndex + 1;
    }

    // item after the last (calculate full height)
    if (index > 0 && index === p.count) {
      let height = p.cachedItemHeights[index - 1]; // already calculated

      if (height === undefined) {
        height = p.itemHeightEstimatorFn ? p.itemHeightEstimatorFn(index - 1) : null; // estimated per item

        if (typeof height !== 'number')
          height = p.estimatedItemHeight; // estimated

        p.cachedItemEstimatedHeights[index - 1] = height;
      }

      return cachedItemPositions[index - 1] + height;
    }

    return cachedItemPositions[index];
  }

  /**
   * Create (or reuse an existing) element for an item at the specified index,
   *   and insert physically at specified position. <br />
   * This will also update the element's position in the `existingEls` array.
   * @param {Element|undefined} itemEl
   * @param {number} index
   * @param {Node|boolean|undefined} insertBefore
   * @param {boolean|undefined} avoidDomReflow
   * @returns {Element}
   * @private
   */
  _dequeueElementForIndex(itemEl, index, insertBefore, avoidDomReflow) {
    const p = this._p;
    const virtualWrapper = p.virtualWrapper;
    const itemParent = p.currentItemsParent;
    const existingEls = p.existingEls;
    const onItemRender = p.onItemRender;
    const onItemUnrender = p.onItemUnrender;
    const isNew = !itemEl;
    const shouldReRender = isNew || index !== itemEl[ItemIndexSymbol];

    if (itemEl) {
      if (onItemUnrender && shouldReRender) {
        onItemUnrender(itemEl);
      }
    } else {
      itemEl = p.itemElementCreatorFn();

      if (virtualWrapper && insertBefore !== false) {
        (/**@type ElementCSSInlineStyle*/itemEl).style.position = 'absolute';
        (/**@type ElementCSSInlineStyle*/itemEl).style.top = '0';
        (/**@type ElementCSSInlineStyle*/itemEl).style.left = '0';
        (/**@type ElementCSSInlineStyle*/itemEl).style.right = '0';
      }
    }

    // Render only if it's a new item element
    //   OR the index of the existing element is not the same of the index to render
    if (shouldReRender) {
      itemEl.innerHTML = ''; // Basic cleanup

      if (onItemRender)
        onItemRender(itemEl, index);
    }

    if (insertBefore !== false) {
      if (!(insertBefore instanceof Node))
        insertBefore = null;

      // Remove from existing list
      if (!isNew) {
        let i = existingEls.indexOf(itemEl);
        if (i !== -1)
          existingEls.splice(i, 1);
      }

      // Insert into existing list
      let beforeIndex = insertBefore ? existingEls.indexOf(/**@type Element*/insertBefore) : -1;
      if (beforeIndex === -1) {
        existingEls.push(itemEl);
      } else {
        existingEls.splice(beforeIndex, 0, itemEl);
      }

      if (!avoidDomReflow) {
        this._insertItemAndFlow(itemEl, index, insertBefore);
      }
    }

    // Add index metadata to item
    itemEl[ItemIndexSymbol] = index;

    return itemEl;
  }

  /**
   * Insert item element into the DOM, set it's flow in the DOM, and update the item's position. <br />
   * @param {Element|undefined} itemEl
   * @param {number} index
   * @param {Node|boolean|undefined} before
   * @private
   */
  _insertItemAndFlow(itemEl, index, before) {
    const p = this._p;
    const virtualWrapper = p.virtualWrapper;
    const itemParent = p.currentItemsParent;

    if (before !== false) {
      if (!(before instanceof Node))
        before = null;

      // Insert into DOM
      if (itemEl.parentNode !== itemParent ||
          (itemEl.nextSibling !== before)) {
        insertBefore(itemEl, before, itemParent);
      }
    }

    if (virtualWrapper) {
      // Calculate height
      let itemHeight = itemEl.getBoundingClientRect().height;

      // Put calculated height into cache, and invalidate positions if it's different
      let cachedItemHeight = p.cachedItemHeights[index];
      if (cachedItemHeight !== itemHeight) {
        p.cachedItemHeights[index] = itemHeight;
      }

      if ((cachedItemHeight !== undefined && itemHeight !== cachedItemHeight) ||
          (cachedItemHeight === undefined && itemHeight !== p.cachedItemEstimatedHeights[index])) {
        this._setItemPositionsNeedsUpdate(index + 1);
      }

      // Set item top position
      let pos = this._calculateItemPosition(index);
      const supportedTransform = getSupportedTransform();

      if (supportedTransform === false) {
        (/**@type ElementCSSInlineStyle*/itemEl).style.top = `${pos}px`;
      } else {
        (/**@type ElementCSSInlineStyle*/itemEl).style[supportedTransform] = `translateY(${pos}px)`;
      }
    }
  }

  /**
   * Fetches valid range of existingEls
   * @returns {{firstIndex: (*|number), firstValidArrayIndex: number, lastValidArrayIndex: number, lastIndex: (*|number)}}
   * @private
   */
  _getExistingElsRange() {
    const p = this._p, existingEls = p.existingEls;

    let firstValidArrayIndex = -1, lastValidArrayIndex = -1;

    for (let i = 0, len = existingEls.length; i < len; i++) {
      if (false === hasOwnProperty.call(existingEls[i], ItemIndexSymbol))
        continue;
      firstValidArrayIndex = i;
      break;
    }

    for (let i = existingEls.length - 1; i >= 0; i--) {
      if (false === hasOwnProperty.call(existingEls[i], ItemIndexSymbol))
        continue;
      lastValidArrayIndex = i;
      break;
    }

    let firstIndex = firstValidArrayIndex !== -1 ? existingEls[firstValidArrayIndex][ItemIndexSymbol] : -1;
    let lastIndex = lastValidArrayIndex !== -1 ? existingEls[lastValidArrayIndex][ItemIndexSymbol] : -1;

    return {
      firstValidArrayIndex: firstValidArrayIndex,
      lastValidArrayIndex: lastValidArrayIndex,
      firstIndex: firstIndex,
      lastIndex: lastIndex,
    };
  }
}

/** Marks the item index associated with an item element */
const ItemIndexSymbol = Symbol('index');

/** Marks an element for reuse */
const ReuseElSymbol = Symbol('reuse');

/**
 * The default element creator
 * @returns {HTMLLIElement}
 */
const defaultElementCreator = () => {
  return document.createElement('li');
};

/**
 * Will look for the index in the `positions` array closest to the specified `pos` value (<= pos).
 * @param {number[]} positions
 * @param {number} pos
 * @param {number} [start=0]
 * @param {number} [end=-1]
 * @returns {number}
 */
const binarySearchPosition = (positions, pos, start = 0, end = -1) => {
  let total = positions.length;
  if (end < 0)
    end += total;
  if (end <= start) return end; // 0 or 1 length array

  while (start <= end) {
    let mid = Math.floor(start + (end - start) / 2);
    let midPos = positions[mid];

    if (midPos === pos || (midPos <= pos && mid < total && positions[mid + 1] > pos)) {
      while (mid > 0 && positions[mid - 1] === midPos) // avoid bugs on 0-height items
        mid--;

      return mid;
    }

    if (midPos < pos)
      start = mid + 1;
    else
      end = mid - 1;
  }

  return end === -1 ? 0 : (total - 1);
};

/**
 * Will look for the index in a virtual list of positions supplied by `total` and `fn`,
 *   closest to the specified `pos` value (<= pos).
 * @param {number} total
 * @param {function(index: number):number} fn
 * @param {number} pos
 * @param {number} [start=0]
 * @param {number} [end=-1]
 * @returns {number}
 */
const binarySearchPositionByFn = (total, fn, pos, start = 0, end = -1) => {
  if (end < 0)
    end += total;
  if (end <= start) return end; // 0 or 1 length array

  while (start <= end) {
    let mid = Math.floor(start + (end - start) / 2);
    let midPos = fn(mid);

    if (midPos === pos || (midPos <= pos && mid < total && fn(mid + 1) > pos)) {
      while (mid > 0 && fn(mid - 1) === midPos) // avoid bugs on 0-height items
        mid--;

      return mid;
    }

    if (midPos < pos)
      start = mid + 1;
    else
      end = mid - 1;
  }

  return end === -1 ? 0 : fn(total - 1);
};

/**
 * Finds the last item in the array for which `fn` returns a truthy value
 * @param {Array} array
 * @param {Function} fn
 * @returns {undefined|*}
 */
const findLast = (array, fn) => {
  for (let i = array.length - 1; i >= 0; i--) {
    if (fn(array[i])) {
      return array[i];
    }
  }
  return undefined;
};

let _isTransformSupported = null;

const getSupportedTransform = () => {
  if (_isTransformSupported === null) {
    let prefixes = ['transform', 'WebkitTransform', 'MozTransform', 'OTransform', 'msTransform'];
    let div = document.createElement('div');
    _isTransformSupported = false;
    for (let item of prefixes) {
      if (div && div.style[item] !== undefined) {
        _isTransformSupported = item;
        break;
      }
    }
  }
  return _isTransformSupported;
};

export default VirtualListHelper;
