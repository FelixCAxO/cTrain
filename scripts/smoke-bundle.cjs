const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const bundlePath = path.resolve(__dirname, '..', 'dist', 'extension.js');
const originalLoad = Module._load;

Module._load = function load(request, parent, isMain) {
  if (request === 'vscode') {
    return {};
  }

  return originalLoad.call(this, request, parent, isMain);
};

try {
  const extension = require(bundlePath);

  assert.equal(typeof extension.activate, 'function');
  assert.equal(typeof extension.deactivate, 'function');
} finally {
  Module._load = originalLoad;
}
