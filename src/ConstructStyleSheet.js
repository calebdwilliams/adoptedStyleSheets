import {
  constructStyleSheetRegistry,
  deferredStyleSheets,
  frame, hasShadyCss, shadyCssAdoptersRegistry,
  state,
} from './shared';
import {instanceOfStyleSheet} from './utils';

const importPattern = /@import/;

const cssStyleSheetMethods = [
  'addImport',
  'addPageRule',
  'addRule',
  'deleteRule',
  'insertRule',
  'removeImport',
  'removeRule',
];

const cssStyleSheetNewMethods = ['replace', 'replaceSync'];

export function updatePrototype(proto) {
  cssStyleSheetNewMethods.forEach(methodKey => {
    proto[methodKey] = ConstructStyleSheet.prototype[methodKey];
  });

  cssStyleSheetMethods.forEach(methodKey => {
    // Here we apply all changes we have done to the original CSSStyleSheet
    // object to all adopted style element.
    const oldMethod = proto[methodKey];

    proto[methodKey] = function(...args) {
      const result = oldMethod.apply(this, args);

      if (constructStyleSheetRegistry.has(this)) {
        const {adopters, actions} = constructStyleSheetRegistry.get(this);

        adopters.forEach(styleElement => {
          if (styleElement.sheet) {
            styleElement.sheet[methodKey](...args);
          }
        });

        if (hasShadyCss && shadyCssAdoptersRegistry.has(this)) {
          const location = shadyCssAdoptersRegistry.get(this);

          // We need to call adoptedStyleSheets setter to re-assign styles
          // to ShadyCSS.
          location.adoptedStyleSheets = location.adoptedStyleSheets;
        }

        // And we also need to remember all these changes to apply them to
        // each newly adopted style element.
        actions.push([methodKey, args]);
      }

      return result;
    };
  });
}

function updateAdopters(sheet) {
  const {adopters, basicStyleElement} = constructStyleSheetRegistry.get(sheet);

  adopters.forEach(styleElement => {
    styleElement.innerHTML = basicStyleElement.innerHTML;
  });

  if (hasShadyCss && shadyCssAdoptersRegistry.has(sheet)) {
    const location = shadyCssAdoptersRegistry.get(sheet);

    // We need to call adoptedStyleSheets setter to re-assign styles
    // to ShadyCSS.
    location.adoptedStyleSheets = location.adoptedStyleSheets;
  }
}

// This class will be a substitute for the CSSStyleSheet class that
// cannot be instantiated. The `new` operation will return the native
// CSSStyleSheet object extracted from a style element appended to the
// iframe.
export default class ConstructStyleSheet {
  constructor() {
    // A style element to extract the native CSSStyleSheet object.
    const basicStyleElement = document.createElement('style');

    if (state.loaded) {
      // If the polyfill is ready, use the frame.body
      frame.body.appendChild(basicStyleElement);
    } else {
      // If the polyfill is not ready, move styles to head temporarily
      document.head.appendChild(basicStyleElement);
      basicStyleElement.disabled = true;
      deferredStyleSheets.push(basicStyleElement);
    }

    const nativeStyleSheet = basicStyleElement.sheet;

    // A support object to preserve all the polyfill data
    constructStyleSheetRegistry.set(nativeStyleSheet, {
      adopters: new Map(),
      actions: [],
      basicStyleElement,
    });

    return nativeStyleSheet;
  }

  replace(contents) {
    return new Promise((resolve, reject) => {
      if (constructStyleSheetRegistry.has(this)) {
        const {basicStyleElement} = constructStyleSheetRegistry.get(this);

        basicStyleElement.innerHTML = contents;
        resolve(basicStyleElement.sheet);
        updateAdopters(this);
      } else {
        reject(
          new Error(
            "Failed to execute 'replace' on 'CSSStyleSheet': Can't call replace on non-constructed CSSStyleSheets.",
          ),
        );
      }
    });
  }

  replaceSync(contents) {
    if (importPattern.test(contents)) {
      throw new Error(
        '@import rules are not allowed when creating stylesheet synchronously',
      );
    }

    if (constructStyleSheetRegistry.has(this)) {
      const {basicStyleElement} = constructStyleSheetRegistry.get(this);

      basicStyleElement.innerHTML = contents;
      updateAdopters(this);

      return basicStyleElement.sheet;
    } else {
      throw new Error(
        "Failed to execute 'replaceSync' on 'CSSStyleSheet': Can't call replaceSync on non-constructed CSSStyleSheets.",
      );
    }
  }
}

Object.defineProperty(ConstructStyleSheet, Symbol.hasInstance, {
  configurable: true,
  value: instanceOfStyleSheet,
});