'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Deliberately small: static CommonJS requires only, with an explicit browser shim.
// Module bodies are preserved verbatim, so adding a domain module needs no alias rewrite.
function bundle({ root, entry, externals = {} }) {
  root = path.resolve(root);
  const modules = new Map();
  const visiting = new Set();
  function moduleId(file) {
    const rel = path.relative(root, file);
    if (rel.startsWith('..') || path.isAbsolute(rel))
      throw new Error(`Module outside root: ${file}`);
    return rel.replaceAll(path.sep, '/');
  }
  function visit(file) {
    const id = moduleId(file);
    if (visiting.has(id)) throw new Error(`Circular runtime dependency: ${id}`);
    if (modules.has(id)) return id;
    visiting.add(id);
    const source = fs.readFileSync(file, 'utf8');
    new vm.Script(`(function(require,module,exports){\n${source}\n})`, {
      filename: id
    });
    const dependencies = {};
    for (const match of source.matchAll(
      /\brequire\(\s*(['"])([^'"]+)\1\s*\)/g
    )) {
      const specifier = match[2];
      let target;
      if (specifier.startsWith('.'))
        target = path.resolve(path.dirname(file), specifier);
      else if (Object.hasOwn(externals, specifier))
        target = path.resolve(root, externals[specifier]);
      else
        throw new Error(`Unsupported browser dependency ${specifier} in ${id}`);
      if (!path.extname(target)) target += '.js';
      dependencies[specifier] = visit(target);
    }
    modules.set(id, { source, dependencies });
    visiting.delete(id);
    return id;
  }
  const entryId = visit(path.resolve(root, entry));
  const definitions = [...modules]
    .map(
      ([id, m]) =>
        `${JSON.stringify(id)}:[function(require,module,exports){\n${m.source}\n},${JSON.stringify(m.dependencies)}]`
    )
    .join(',\n');
  const code = `const definitions={\n${definitions}\n};
const moduleCache=Object.create(null);
function loadModule(id){
  if(moduleCache[id])return moduleCache[id].exports;
  const definition=definitions[id];
  if(!definition)throw new Error('Unknown runtime module: '+id);
  const module={exports:{}};moduleCache[id]=module;
  const localRequire=name=>{
    if(!Object.prototype.hasOwnProperty.call(definition[1],name))throw new Error('Unknown dependency: '+name);
    return loadModule(definition[1][name]);
  };
  definition[0](localRequire,module,module.exports);
  return module.exports;
}
const entry=loadModule(${JSON.stringify(entryId)});`;
  return { code, modules: [...modules.keys()] };
}

module.exports = { bundle };
