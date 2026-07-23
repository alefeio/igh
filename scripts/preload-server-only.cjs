const Module = require("module");
const path = require("path");

const stub = path.join(__dirname, "shims", "server-only.js");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return stub;
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
