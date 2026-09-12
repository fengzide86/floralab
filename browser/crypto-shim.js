'use strict';

// Stable legacy browser hash/UUID behavior; this hash is not cryptographic.
const CryptoShim = {
  randomUUID() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0,
        v = c === 'x' ? r : (r & 3) | 8;
      return v.toString(16);
    });
  },
  createHash() {
    let data = '';
    return {
      update(v) {
        data += String(v);
        return this;
      },
      digest() {
        let a = 0x811c9dc5,
          b = 0x9e3779b9,
          c = 0x85ebca6b,
          d = 0xc2b2ae35,
          e = 0x27d4eb2f;
        for (let i = 0; i < data.length; i++) {
          const x = data.charCodeAt(i);
          a = Math.imul(a ^ x, 0x01000193);
          b = Math.imul(b ^ (x + i), 0x85ebca6b);
          c = Math.imul(c ^ (x << 1), 0xc2b2ae35);
          d = Math.imul(d ^ (x << 2), 0x27d4eb2f);
          e = Math.imul(e ^ (x << 3), 0x165667b1);
        }
        return [a, b, c, d, e]
          .map((n) => (n >>> 0).toString(16).padStart(8, '0'))
          .join('');
      }
    };
  }
};

module.exports = CryptoShim;
