'use strict';

const Studio = require('../lib/studio');
const Engine = require('../lib/engine');
const Versions = require('../lib/versions');
const { createRuntime } = require('../lib/runtime');

function createBrowserRuntime({ fetch, baseUrl, version }) {
  let catalogPromise = null;
  function getCatalog() {
    if (!catalogPromise) {
      catalogPromise = Promise.resolve()
        .then(() => fetch(new URL('./data/catalog.json?v='+encodeURIComponent(version), baseUrl).href))
        .then((response) => {
          if (!response.ok) throw new Error('catalog_load_failed');
          return response.json();
        })
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }
  return createRuntime({
    Studio,
    Engine,
    Versions,
    getCatalog,
    version,
    baseUrl
  });
}

module.exports = { createBrowserRuntime };
