# @danielgindi/virtual-list-helper
A full featured dom virtual list

* Supports custom elements
* Supports dynamic heights
* Item height estimations are *optional*
* Native scrolling
* Allows reverting to non-virtual list

---

## Example

The default exported class is `VirtualListHelper`, which does all the magic.  
There is now also a Vue (v3) binding, in vue/VirtualList.vue.  
I really hope to put in an example here soon. PRs are welcome.

## Api

---
#### VirtualListHelper~Options

| Property      | Type           | Default | Meaning  |
| ------------- |:-------------:|:---------:|:--------|
| list                  | `Element` | | the main element to operate inside of |
| hookScrollEvent       | `boolean` | `true` | automatically hook scroll event as needed |
| count                 | `number`  | `0` | the item count |
| virtual               | `boolean` | `true` | is virtual mode on? |
| estimatedItemHeight   | `number`  | `20` | estimated item height |
| buffer                | `number`  | `5` | the amount of buffer items to keep on each end of the list |
| itemHeightEstimatorFn | `ItemHeightEstimatorFunction` | | an optional function for providing item height estimations |
| itemElementCreatorFn  | `ItemElementCreatorFunction`  | | an optional function for providing fresh item elements (default creates `<li />`s) |
| onItemRender          | `ItemRenderFunction`          | | a function for rendering element content based on item index |
| onItemUnrender        | `ItemUnrenderFunction`        | | a function for freeing resources in an item element |

---
#### ItemHeightEstimatorFunction

* Type: `function(index: number):(number|undefined)`
* Responsible for generating item height estimations. This is optional.

| Argument      | Type           | Meaning  |
| ------------- |:-------------:|:---------:|
| index         | `number` | index of the item to get an estimate for |
| `return`      | `number`, `undefined` | the estimation, or `undefined` to use default estimate |

---
#### ItemElementCreatorFunction
* Type: `function():Element`
* Responsible for generating item element (regardless of specific item contents!).
* The default creates and `<li>` element.

| Argument      | Type           | Meaning  |
| ------------- |:-------------:|:---------:|
| `return`      | `Element`     | the element to serve as the item |

---
#### ItemRenderFunction
* Type: `function(itemEl: Element, index: number)`
* Responsible for rendering an item's contents. If you bind any resources that should be deallocated or unbound, you can do so in the `ItemUnrenderFunction`.

| Argument      | Type           | Meaning  |
| ------------- |:-------------:|:---------:|
| itemEl        | `Element`     | the element in which to render the item contents |
| index         | `number`      | the index of the item |

---
#### ItemUnrenderFunction
* Type: `function(itemEl: Element)`  
* Responsible for cleaning stuff up after an element. Specifically unbinding events or other native resources that were captured during ItemRenderFunction.
* The elements will always be cleared automatically from child elements regardless of what you do in `ItemRenderFunction`.

| Argument      | Type           | Meaning  |
| ------------- |:-------------:|:---------:|
| itemEl        | `Element`     | the element in which to un-render the item contents |

---
#### VirtualListHelper

This class' api is pretty much self explanatory, but I'll try to find the time to document it properly and add examples.

## Development

The helper source is in `src/index.ts`, with a TypeScript Vue binding in `vue/`.
Run `npm run build` to compile JavaScript and declarations into the existing
`lib/` and `vue/` entry paths and generate the ESM, UMD, and CommonJS bundles in `dist/`.
Use `npm run typecheck` to check both the helper and Vue binding, or
`npm run build:types` to generate their declarations only.

## Tests

Install dependencies and Chromium, then run the complete local check:

```sh
npm ci
npx playwright install chromium
npm test
```

`npm test` builds the package, runs Vitest, checks the test code, and checks
strict consumers of the generated TypeScript declarations. The browser tests use
real layout and scrolling rather than mocked element measurements.

| Tests | Coverage |
| --- | --- |
| `tests/browser/core.test.ts` | Configuration, height estimates, viewport boundaries, buffers, variable and zero heights, scrolling and reuse, insert/remove/refresh, mode changes, callbacks, ghost items, and teardown |
| `tests/browser/vue.test.ts` | Root attributes, slot data, reactive count/items/mode/width/height settings, scrolling, emitted height changes, public invalidation, and unmounting |
| `tests/browser/dist.test.ts` | Generated JavaScript entry and both ESM bundles with real rendering and scrolling |
| `tests/package/package.test.ts` | All six bundle banners/maps, UMD and CommonJS script exports, the real ESM dependency, and published runtime/type files |
| `tests/types/public-api.ts` | Published callback types, optional lookup results, fluent methods, Vue props/events/methods, and rejected invalid consumer code |

Focused commands are `npm run test:browser`, `npm run test:package`,
`npm run test:types`, and `npm run test:watch`. Run `npm run build` before
browser-only or watch runs, since they also exercise generated entries.

Chromium is the default. To run more engines, install them with
`npx playwright install chromium firefox webkit` and set `TEST_BROWSERS` to
a comma-separated list. For example, in PowerShell:

```powershell
$env:TEST_BROWSERS = 'chromium,firefox,webkit'
npm test
```

The GitHub Actions workflow runs all three engines on Linux.

Regression tests cover constructor wrapper widths, requested item heights,
empty and final viewport counts, cleanup after virtual-list invalidation,
and Node loading of both CommonJS bundles. CommonJS output uses `.cjs` extensions.

The Vue binding also emits a known warning about invoking item slots outside a
render function; the Vue tests filter that specific warning and reject other warnings.

## Me
* Hi! I am Daniel Cohen Gindi. Or in short- Daniel.
* danielgindi@gmail.com is my email address.
* That's all you need to know.

## Help

If you want to help, you could:
* Actually code, and issue pull requests
* Test the library under different conditions and browsers
* Create more demo pages
* Spread the word
* [![Donate](https://www.paypalobjects.com/en_US/i/btn/btn_donate_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=45T5QNATLCPS2)


## License

All the code here is under MIT license. Which means you could do virtually anything with the code.
I will appreciate it very much if you keep an attribution where appropriate.

    The MIT License (MIT)
    
    Copyright (c) 2013 Daniel Cohen Gindi (danielgindi@gmail.com)
    
    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:
    
    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.
    
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
