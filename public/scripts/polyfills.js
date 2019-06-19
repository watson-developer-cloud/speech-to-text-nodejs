// todo: serve this file seperately and only load when needed...

// polyfills for Promise, Object.assign, etc.
import 'core-js/stable';
import 'regenerator-runtime/runtime';

// fetch polyfill for Safari / IE
// automatically sets global
import 'whatwg-fetch';
