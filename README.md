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
