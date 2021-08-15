// Runtime header offsets
const ID_OFFSET = -8;
const SIZE_OFFSET = -4;

// Runtime ids
const ARRAYBUFFER_ID = 0;
const STRING_ID = 1;
// const ARRAYBUFFERVIEW_ID = 2;

// Runtime type information
const ARRAYBUFFERVIEW = 1 << 0;
const ARRAY = 1 << 1;
const STATICARRAY = 1 << 2;
// const SET = 1 << 3;
// const MAP = 1 << 4;
const VAL_ALIGN_OFFSET = 6;
// const VAL_ALIGN = 1 << VAL_ALIGN_OFFSET;
const VAL_SIGNED = 1 << 11;
const VAL_FLOAT = 1 << 12;
// const VAL_NULLABLE = 1 << 13;
const VAL_MANAGED = 1 << 14;
// const KEY_ALIGN_OFFSET = 15;
// const KEY_ALIGN = 1 << KEY_ALIGN_OFFSET;
// const KEY_SIGNED = 1 << 20;
// const KEY_FLOAT = 1 << 21;
// const KEY_NULLABLE = 1 << 22;
// const KEY_MANAGED = 1 << 23;

// Array(BufferView) layout
const ARRAYBUFFERVIEW_BUFFER_OFFSET = 0;
const ARRAYBUFFERVIEW_DATASTART_OFFSET = 4;
const ARRAYBUFFERVIEW_DATALENGTH_OFFSET = 8;
const ARRAYBUFFERVIEW_SIZE = 12;
const ARRAY_LENGTH_OFFSET = 12;
const ARRAY_SIZE = 16;

const BIGINT = typeof BigUint64Array !== "undefined";
const THIS = Symbol();

const STRING_DECODE_THRESHOLD = 32;
const decoder = new TextDecoder("utf-16le");

/** Gets a string from an U32 and an U16 view on a memory. */
function getStringImpl(buffer, ptr) {
  const len = new Uint32Array(buffer)[ptr + SIZE_OFFSET >>> 2] >>> 1;
  const arr = new Uint16Array(buffer, ptr, len);
  if (len <= STRING_DECODE_THRESHOLD) {
    return String.fromCharCode.apply(String, arr);
  }
  return decoder.decode(arr);
}

/** Prepares the base module prior to instantiation. */
function preInstantiate(imports) {
  const extendedExports = {};

  function getString(memory, ptr) {
    if (!memory) return "<yet unknown>";
    return getStringImpl(memory.buffer, ptr);
  }

  // add common imports used by stdlib for convenience
  const env = (imports.env = imports.env || {});
  env.abort = env.abort || function abort(msg, file, line, colm) {
    const memory = extendedExports.memory || env.memory; // prefer exported, otherwise try imported
    throw Error(`abort: ${getString(memory, msg)} at ${getString(memory, file)}:${line}:${colm}`);
  };
  env.trace = env.trace || function trace(msg, n, ...args) {
    const memory = extendedExports.memory || env.memory;
    console.log(`trace: ${getString(memory, msg)}${n ? " " : ""}${args.slice(0, n).join(", ")}`);
  };
  env.seed = env.seed || Date.now;
  imports.Math = imports.Math || Math;
  imports.Date = imports.Date || Date;

  return extendedExports;
}

const E_NOEXPORTRUNTIME = "Operation requires compiling with --exportRuntime";
const F_NOEXPORTRUNTIME = function () { throw Error(E_NOEXPORTRUNTIME); };

/** Prepares the final module once instantiation is complete. */
function postInstantiate(extendedExports, instance) {
  const exports = instance.exports;
  const memory = exports.memory;
  const table = exports.table;
  const __new = exports.__new || F_NOEXPORTRUNTIME;
  const __pin = exports.__pin || F_NOEXPORTRUNTIME;
  const __unpin = exports.__unpin || F_NOEXPORTRUNTIME;
  const __collect = exports.__collect || F_NOEXPORTRUNTIME;
  const __rtti_base = exports.__rtti_base;
  const getRttiCount = __rtti_base
    ? function (arr) { return arr[__rtti_base >>> 2]; }
    : F_NOEXPORTRUNTIME;

  extendedExports.__new = __new;
  extendedExports.__pin = __pin;
  extendedExports.__unpin = __unpin;
  extendedExports.__collect = __collect;

  /** Gets the runtime type info for the given id. */
  function getInfo(id) {
    const U32 = new Uint32Array(memory.buffer);
    const count = getRttiCount(U32);
    if ((id >>>= 0) >= count) throw Error(`invalid id: ${id}`);
    return U32[(__rtti_base + 4 >>> 2) + id * 2];
  }

  /** Gets and validate runtime type info for the given id for array like objects */
  function getArrayInfo(id) {
    const info = getInfo(id);
    if (!(info & (ARRAYBUFFERVIEW | ARRAY | STATICARRAY))) throw Error(`not an array: ${id}, flags=${info}`);
    return info;
  }

  /** Gets the runtime base id for the given id. */
  function getBase(id) {
    const U32 = new Uint32Array(memory.buffer);
    const count = getRttiCount(U32);
    if ((id >>>= 0) >= count) throw Error(`invalid id: ${id}`);
    return U32[(__rtti_base + 4 >>> 2) + id * 2 + 1];
  }

  /** Gets the runtime alignment of a collection's values. */
  function getValueAlign(info) {
    return 31 - Math.clz32((info >>> VAL_ALIGN_OFFSET) & 31); // -1 if none
  }

  /** Gets the runtime alignment of a collection's keys. */
  // function getKeyAlign(info) {
  //   return 31 - Math.clz32((info >>> KEY_ALIGN_OFFSET) & 31); // -1 if none
  // }

  /** Allocates a new string in the module's memory and returns its pointer. */
  function __newString(str) {
    if (str == null) return 0;
    const length = str.length;
    const ptr = __new(length << 1, STRING_ID);
    const U16 = new Uint16Array(memory.buffer);
    for (var i = 0, p = ptr >>> 1; i < length; ++i) U16[p + i] = str.charCodeAt(i);
    return ptr;
  }

  extendedExports.__newString = __newString;

  /** Reads a string from the module's memory by its pointer. */
  function __getString(ptr) {
    if (!ptr) return null;
    const buffer = memory.buffer;
    const id = new Uint32Array(buffer)[ptr + ID_OFFSET >>> 2];
    if (id !== STRING_ID) throw Error(`not a string: ${ptr}`);
    return getStringImpl(buffer, ptr);
  }

  extendedExports.__getString = __getString;

  /** Gets the view matching the specified alignment, signedness and floatness. */
  function getView(alignLog2, signed, float) {
    const buffer = memory.buffer;
    if (float) {
      switch (alignLog2) {
        case 2: return new Float32Array(buffer);
        case 3: return new Float64Array(buffer);
      }
    } else {
      switch (alignLog2) {
        case 0: return new (signed ? Int8Array : Uint8Array)(buffer);
        case 1: return new (signed ? Int16Array : Uint16Array)(buffer);
        case 2: return new (signed ? Int32Array : Uint32Array)(buffer);
        case 3: return new (signed ? BigInt64Array : BigUint64Array)(buffer);
      }
    }
    throw Error(`unsupported align: ${alignLog2}`);
  }

  /** Allocates a new array in the module's memory and returns its pointer. */
  function __newArray(id, values) {
    const info = getArrayInfo(id);
    const align = getValueAlign(info);
    const length = values.length;
    const buf = __new(length << align, info & STATICARRAY ? id : ARRAYBUFFER_ID);
    let result;
    if (info & STATICARRAY) {
      result = buf;
    } else {
      __pin(buf);
      const arr = __new(info & ARRAY ? ARRAY_SIZE : ARRAYBUFFERVIEW_SIZE, id);
      __unpin(buf);
      const U32 = new Uint32Array(memory.buffer);
      U32[arr + ARRAYBUFFERVIEW_BUFFER_OFFSET >>> 2] = buf;
      U32[arr + ARRAYBUFFERVIEW_DATASTART_OFFSET >>> 2] = buf;
      U32[arr + ARRAYBUFFERVIEW_DATALENGTH_OFFSET >>> 2] = length << align;
      if (info & ARRAY) U32[arr + ARRAY_LENGTH_OFFSET >>> 2] = length;
      result = arr;
    }
    const view = getView(align, info & VAL_SIGNED, info & VAL_FLOAT);
    if (info & VAL_MANAGED) {
      for (let i = 0; i < length; ++i) {
        const value = values[i];
        view[(buf >>> align) + i] = value;
      }
    } else {
      view.set(values, buf >>> align);
    }
    return result;
  }

  extendedExports.__newArray = __newArray;

  /** Gets a live view on an array's values in the module's memory. Infers the array type from RTTI. */
  function __getArrayView(arr) {
    const U32 = new Uint32Array(memory.buffer);
    const id = U32[arr + ID_OFFSET >>> 2];
    const info = getArrayInfo(id);
    const align = getValueAlign(info);
    let buf = info & STATICARRAY
      ? arr
      : U32[arr + ARRAYBUFFERVIEW_DATASTART_OFFSET >>> 2];
    const length = info & ARRAY
      ? U32[arr + ARRAY_LENGTH_OFFSET >>> 2]
      : U32[buf + SIZE_OFFSET >>> 2] >>> align;
    return getView(align, info & VAL_SIGNED, info & VAL_FLOAT).subarray(buf >>>= align, buf + length);
  }

  extendedExports.__getArrayView = __getArrayView;

  /** Copies an array's values from the module's memory. Infers the array type from RTTI. */
  function __getArray(arr) {
    const input = __getArrayView(arr);
    const len = input.length;
    const out = new Array(len);
    for (let i = 0; i < len; i++) out[i] = input[i];
    return out;
  }

  extendedExports.__getArray = __getArray;

  /** Copies an ArrayBuffer's value from the module's memory. */
  function __getArrayBuffer(ptr) {
    const buffer = memory.buffer;
    const length = new Uint32Array(buffer)[ptr + SIZE_OFFSET >>> 2];
    return buffer.slice(ptr, ptr + length);
  }

  extendedExports.__getArrayBuffer = __getArrayBuffer;

  /** Copies a typed array's values from the module's memory. */
  function getTypedArray(Type, alignLog2, ptr) {
    return new Type(getTypedArrayView(Type, alignLog2, ptr));
  }

  /** Gets a live view on a typed array's values in the module's memory. */
  function getTypedArrayView(Type, alignLog2, ptr) {
    const buffer = memory.buffer;
    const U32 = new Uint32Array(buffer);
    const bufPtr = U32[ptr + ARRAYBUFFERVIEW_DATASTART_OFFSET >>> 2];
    return new Type(buffer, bufPtr, U32[bufPtr + SIZE_OFFSET >>> 2] >>> alignLog2);
  }

  /** Attach a set of get TypedArray and View functions to the exports. */
  function attachTypedArrayFunctions(ctor, name, align) {
    extendedExports[`__get${name}`] = getTypedArray.bind(null, ctor, align);
    extendedExports[`__get${name}View`] = getTypedArrayView.bind(null, ctor, align);
  }

  [
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array
  ].forEach(ctor => {
    attachTypedArrayFunctions(ctor, ctor.name, 31 - Math.clz32(ctor.BYTES_PER_ELEMENT));
  });

  if (BIGINT) {
    [BigUint64Array, BigInt64Array].forEach(ctor => {
      attachTypedArrayFunctions(ctor, ctor.name.slice(3), 3);
    });
  }

  /** Tests whether an object is an instance of the class represented by the specified base id. */
  function __instanceof(ptr, baseId) {
    const U32 = new Uint32Array(memory.buffer);
    let id = U32[ptr + ID_OFFSET >>> 2];
    if (id <= getRttiCount(U32)) {
      do {
        if (id == baseId) return true;
        id = getBase(id);
      } while (id);
    }
    return false;
  }

  extendedExports.__instanceof = __instanceof;

  // Pull basic exports to extendedExports so code in preInstantiate can use them
  extendedExports.memory = extendedExports.memory || memory;
  extendedExports.table = extendedExports.table || table;

  // Demangle exports and provide the usual utility on the prototype
  return demangle(exports, extendedExports);
}

function isResponse(src) {
  return typeof Response !== "undefined" && src instanceof Response;
}

function isModule(src) {
  return src instanceof WebAssembly.Module;
}

/** Asynchronously instantiates an AssemblyScript module from anything that can be instantiated. */
async function instantiate(source, imports = {}) {
  if (isResponse(source = await source)) return instantiateStreaming(source, imports);
  const module = isModule(source) ? source : await WebAssembly.compile(source);
  const extended = preInstantiate(imports);
  const instance = await WebAssembly.instantiate(module, imports);
  const exports = postInstantiate(extended, instance);
  return { module, instance, exports };
}

/** Synchronously instantiates an AssemblyScript module from a WebAssembly.Module or binary buffer. */
function instantiateSync(source, imports = {}) {
  const module = isModule(source) ? source : new WebAssembly.Module(source);
  const extended = preInstantiate(imports);
  const instance = new WebAssembly.Instance(module, imports);
  const exports = postInstantiate(extended, instance);
  return { module, instance, exports };
}

/** Asynchronously instantiates an AssemblyScript module from a response, i.e. as obtained by `fetch`. */
async function instantiateStreaming(source, imports = {}) {
  if (!WebAssembly.instantiateStreaming) {
    return instantiate(
      isResponse(source = await source)
        ? source.arrayBuffer()
        : source,
      imports
    );
  }
  const extended = preInstantiate(imports);
  const result = await WebAssembly.instantiateStreaming(source, imports);
  const exports = postInstantiate(extended, result.instance);
  return { ...result, exports };
}

/** Demangles an AssemblyScript module's exports to a friendly object structure. */
function demangle(exports, extendedExports = {}) {
  const setArgumentsLength = exports["__argumentsLength"]
    ? length => { exports["__argumentsLength"].value = length; }
    : exports["__setArgumentsLength"] || exports["__setargc"] || (() => { /* nop */ });
  for (let internalName in exports) {
    if (!Object.prototype.hasOwnProperty.call(exports, internalName)) continue;
    const elem = exports[internalName];
    let parts = internalName.split(".");
    let curr = extendedExports;
    while (parts.length > 1) {
      let part = parts.shift();
      if (!Object.prototype.hasOwnProperty.call(curr, part)) curr[part] = {};
      curr = curr[part];
    }
    let name = parts[0];
    let hash = name.indexOf("#");
    if (hash >= 0) {
      const className = name.substring(0, hash);
      const classElem = curr[className];
      if (typeof classElem === "undefined" || !classElem.prototype) {
        const ctor = function (...args) {
          return ctor.wrap(ctor.prototype.constructor(0, ...args));
        };
        ctor.prototype = {
          valueOf() { return this[THIS]; }
        };
        ctor.wrap = function (thisValue) {
          return Object.create(ctor.prototype, { [THIS]: { value: thisValue, writable: false } });
        };
        if (classElem) Object.getOwnPropertyNames(classElem).forEach(name =>
          Object.defineProperty(ctor, name, Object.getOwnPropertyDescriptor(classElem, name))
        );
        curr[className] = ctor;
      }
      name = name.substring(hash + 1);
      curr = curr[className].prototype;
      if (/^(get|set):/.test(name)) {
        if (!Object.prototype.hasOwnProperty.call(curr, name = name.substring(4))) {
          let getter = exports[internalName.replace("set:", "get:")];
          let setter = exports[internalName.replace("get:", "set:")];
          Object.defineProperty(curr, name, {
            get() { return getter(this[THIS]); },
            set(value) { setter(this[THIS], value); },
            enumerable: true
          });
        }
      } else {
        if (name === 'constructor') {
          (curr[name] = (...args) => {
            setArgumentsLength(args.length);
            return elem(...args);
          }).original = elem;
        } else { // instance method
          (curr[name] = function (...args) { // !
            setArgumentsLength(args.length);
            return elem(this[THIS], ...args);
          }).original = elem;
        }
      }
    } else {
      if (/^(get|set):/.test(name)) {
        if (!Object.prototype.hasOwnProperty.call(curr, name = name.substring(4))) {
          Object.defineProperty(curr, name, {
            get: exports[internalName.replace("set:", "get:")],
            set: exports[internalName.replace("get:", "set:")],
            enumerable: true
          });
        }
      } else if (typeof elem === "function" && elem !== setArgumentsLength) {
        (curr[name] = (...args) => {
          setArgumentsLength(args.length);
          return elem(...args);
        }).original = elem;
      } else {
        curr[name] = elem;
      }
    }
  }
  return extendedExports;
}

var loader = {
  instantiate,
  instantiateSync,
  instantiateStreaming,
  demangle
};

var wasmB64 = "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AUECdGooAgQiAkUEQEEAQdALQdcCQRIQAAALIAAgAmggAUEEdGpBAnRqKAJgBUEACwsL6QIBA38gAUH8////A0sEQEGACUHQC0HKA0EdEAAACyAAQQwgAUETakFwcUEEayABQQxNGyICEA4iAUUEQEEEPwAiAUEQdEEEayAAKAKgDEd0IAJBAUEbIAJna3RBAWtqIAIgAkH+////AUkbakH//wNqQYCAfHFBEHYhAyABIAMgASADShtAAEEASARAIANAAEEASARAAAsLIAAgAUEQdD8AQRB0EAsgACACEA4iAUUEQEEAQdALQfADQRAQAAALCyACIAEoAgBBfHFLBEBBAEHQC0HyA0EOEAAACyAAIAEQCSABKAIAIQMgAkEEakEPcQRAQQBB0AtB5QJBDhAAAAsgA0F8cSACayIEQRBPBEAgASACIANBAnFyNgIAIAIgAUEEamoiAiAEQQRrQQFyNgIAIAAgAhAKBSABIANBfnE2AgAgAUEEaiIAIAEoAgBBfHFqIAAgASgCAEF8cWooAgBBfXE2AgALIAEL1gIBAX8CQCABRQ0AIABBADoAACAAIAFqIgJBAWtBADoAACABQQJNDQAgAEEAOgABIABBADoAAiACQQJrQQA6AAAgAkEDa0EAOgAAIAFBBk0NACAAQQA6AAMgAkEEa0EAOgAAIAFBCE0NACAAQQAgAGtBA3EiAmoiAEEANgIAIAAgASACa0F8cSICaiIBQQRrQQA2AgAgAkEITQ0AIABBADYCBCAAQQA2AgggAUEMa0EANgIAIAFBCGtBADYCACACQRhNDQAgAEEANgIMIABBADYCECAAQQA2AhQgAEEANgIYIAFBHGtBADYCACABQRhrQQA2AgAgAUEUa0EANgIAIAFBEGtBADYCACAAIABBBHFBGGoiAWohACACIAFrIQEDQCABQSBPBEAgAEIANwMAIABCADcDCCAAQgA3AxAgAEIANwMYIAFBIGshASAAQSBqIQAMAQsLCwuyAQEBfyAAQez///8DTwRAQYAJQcAJQYQCQR8QAAALIwQjBU8EQAJAQYAQIQIDQCACEA1rIQIjBkUEQCMErULIAX5C5ACAp0GACGokBQwCCyACQQBKDQALIwQjBCMFa0GACElBCnRqJAULCyAAQRBqIQIjDUUEQBAMCyMNIAIQDyICIAE2AgwgAiAANgIQIAIjDCMLEAYjBCACKAIAQXxxQQRqaiQEIAJBFGoiASAAEBAgAQtpAQJ/IAFFBEAPCyAARQRAQQBBwAlBpgJBDhAAAAsjCyABQRRrIgEoAgRBA3FGBEAgAEEUayIAKAIEQQNxIgMhBCADIwtFRgRAIAAgASACGxAHBSMGQQFGQQAgBEEDRhsEQCABEAcLCwsLEQAgACABNgIAIAAgAUEAEBILKQAgASAAKAIMTwRAQcAKQdAIQeMAQSoQAAALIAAoAgQgAUEDdGorAwALsAIBAn8CQCACIQQgACABRg0AIAAgAUkEQCABQQdxIABBB3FGBEADQCAAQQdxBEAgBEUNBCAEQQFrIQQgACICQQFqIQAgASIDQQFqIQEgAiADLQAAOgAADAELCwNAIARBCE8EQCAAIAEpAwA3AwAgBEEIayEEIABBCGohACABQQhqIQEMAQsLCwNAIAQEQCAAIgJBAWohACABIgNBAWohASACIAMtAAA6AAAgBEEBayEEDAELCwUgAUEHcSAAQQdxRgRAA0AgACAEakEHcQRAIARFDQQgBEEBayIEIABqIAEgBGotAAA6AAAMAQsLA0AgBEEITwRAIARBCGsiBCAAaiABIARqKQMANwMADAELCwsDQCAEBEAgBEEBayIEIABqIAEgBGotAAA6AAAMAQsLCwsLEgAgACgCBCABQQN0aiACOQMAC94BAQV/IAEgACgCCCIGIAJ2SwRAIAFB/P///wMgAnZLBEBBoAhB0AhBEUEwEAAACyAAKAIAIgchAwJAIAZBAXQiBEH8////AyAEQfz///8DSRsiBCABQQggAUEISxsgAnQiASABIARJGyIEIgUgB0EUayICKAIAQXxxQRBrTQRAIAIgBTYCECADIQEMAQsgBSACKAIMEBEiASADIAUgAigCECICIAIgBUsbEBULIAEgBmogBCAGaxAQIAEgB0cEQCAAIAE2AgAgACABNgIEIAAgAUEAEBILIAAgBDYCCAsLGgAgACgCBCABQQJ0aiACNgIAIAAgAkEBEBILNgAgAEEAEBQgAUEAEBRjBH9BfwUgAEEAEBQgAUEAEBRkBH9BAQUgAEEBEBQgAUEBEBShqgsLC6gBAQV/IxFBCGskERA0IxFCADcDAANAIAEgBUoEQCMRIAAgBUECdGooAgAiBjYCACAFQQFrIQMDQCADQQBOBEACQCMRIAAgA0ECdGooAgAiBzYCBEECJA4gBiAHIAIoAgARAgBBAE4NACADIgRBAWshAyAAIARBAWpBAnRqIAc2AgAMAgsLCyAAIANBAWpBAnRqIAY2AgAgBUEBaiEFDAELCyMRQQhqJBELNgAgAEEAEBQgAUEAEBRjBH9BAQUgAEEAEBQgAUEAEBRkBH9BfwUgAUEBEBQgAEEBEBShqgsLC0EBAX8gASAAKAIMTwRAIAFBAEgEQEHACkHQCEHzAEEWEAAACyAAIAFBAWoiA0EDEBcgACADNgIMCyAAIAEgAhAWCxEAIAAgATYCCCAAIAFBABASC2ICAX8BfiAAvSICp0G93MqVfGxBuc/ZsgFqQRF3Qa/W074CbCACQiCIp0G93MqVfGxqQRF3Qa/W074CbCIBIAFBD3ZzQfeUr694bCIBIAFBDXZzQb3cypV8bCIBIAFBEHZzC9QBAgd/AXwjEUEIayQREDQjEUIANwMAIxEgAUEBaiICQQJ0EDsiBzYCACMRIAJBA3RBA20iBkEEdBA7IgM2AgQgACgCCCIIIAAoAhBBBHRqIQUgAyECA0AgBSAIRwRAIAgoAghBAXFFBEACfyACIAgrAwAiCTkDACACIAcgCRAeIAFxQQJ0aiIEKAIANgIIIAQgAjYCACACQRBqCyECCyAIQRBqIQgMAQsLIAAgBxATIAAgATYCBCAAIAMQHSAAIAY2AgwgACAAKAIUNgIQIxFBCGokEQvjAQEDfyABEB4hBCAAKAIAIAQgACgCBHFBAnRqKAIAIQICQANAIAIEQCACKAIIIgNBAXEEf0EABSABIAIrAwBhCw0CIANBfnEhAgwBCwtBACECCyACRQRAIAAoAhAgACgCDEYEQCAAIAAoAhQgACgCDEEDbEEEbUgEfyAAKAIEBSAAKAIEQQF0QQFyCxAfCyAAKAIIIQMgACAAKAIQIgJBAWo2AhAgAyACQQR0aiICIAE5AwAgACAAKAIUQQFqNgIUIAIgACgCACAEIAAoAgRxQQJ0aiIAKAIANgIIIAAgAjYCAAsLBAAgAQspACABIAAoAgxPBEBBwApB0AhB4wBBKhAAAAsgACgCBCABQQJ0aigCAAtJAQF/IAEgACgCDE8EQCABQQBIBEBBwApB0AhB8wBBFhAAAAsgACABQQFqIgNBAhAXIAAgAzYCDAsgACgCBCABQQJ0aiACNgIAC3UBA38gACgCDEEBayEDA0AgAyAEa0EBSgRAIAAgBLcgAyAEa0ECbbecoKoiAhAUIAFjBEAgAiEEBSAAIAIQFCABZEUEQCACDwsgAiEDCwwBCwsgACADEBQgAWMEQCADQQFqDwsgACAEEBQgAWQEQCAEDwsgAwsRACAAIAE2AiQgACABQQAQEgsRACAAIAE2AiggACABQQAQEgsRACAAIAE2AiwgACABQQAQEgsEACAACxEAIAAgATYCMCAAIAFBABASC1oCAn8BfCAAKAIMIgIEQCAAKAIEIQEgACgCBCACQQFrQQN0aiEAA0AgACABSwRAIAErAwAhAyABIAArAwA5AwAgACADOQMAIAFBCGohASAAQQhrIQAMAQsLCwstAQJ/IAAgACgCDCICQQFqIgNBAxAXIAAoAgQgAkEDdGogATkDACAAIAM2AgwL7gMBAn8jEUEYayQREDQjEUIANwMAIxFCADcDCCMRQgA3AxAgASACIANBARA1IxEgASACIAMQPSIDNgIAIxEgA0EAEDoiAjYCBCMRIANBARA6IgE2AggjESADQQIQOiIDNgIMIAAtACBFBEAgARAqIAMQKgsgASADEDYDQCAEIAEoAgxIBEAgASAEEBQgACsDAGMEQCABIAQgACsDABAcCyABIAQQFCAAKwMIZARAIAEgBCAAKwMIEBwLIARBAWohBAwBCwsgAC0AIEUEQCABECoLQQAhBANAIAQgAigCDEgEQCACIAQQFCAAKwMYZARAIAAgAiAEEBQ5AxgLIAIgBBAUIAArAxBjBEAgACACIAQQFDkDEAsgBEEBaiEEDAELCyMRQQAQPCIENgIQIxFBABA8IgU2AhQgBCACQQAQFBArIAUgAUEAEBQQK0EBIQMDQCADIAEoAgxBAWtIBEAgASADEBQgASADQQFrEBShmUSN7bWg98awPmQEf0EBBSABIAMQFCABIANBAWoQFKGZRI3ttaD3xrA+ZAsEQCAEIAIgAxAUECsgBSABIAMQFBArCyADQQFqIQMMAQsLIAQgAiACKAIMQQFrEBQQKyAFIAEgASgCDEEBaxAUECsgACAEECUgACAFECYjEUEYaiQRCy8AIAEgACgCCEEDdk8EQEHACkHwD0HpCkHAABAAAAsgACgCBCABQQN0aiACOQMACzgBAX8gAARAIABBFGsiASgC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ACMRQQRrJBEQNCMRIAA2AgAgACABECQhACMRQQRqJBEgAAskAQF8IxFBBGskERA0IxEgADYCACAAKwMAIQEjEUEEaiQRIAELIAAjEUEEayQREDQjESAANgIAIAAgATkDACMRQQRqJBELJAEBfCMRQQRrJBEQNCMRIAA2AgAgACsDCCEBIxFBBGokESABCyAAIxFBBGskERA0IxEgADYCACAAIAE5AwgjEUEEaiQRCyQBAXwjEUEEayQREDQjESAANgIAIAArAxAhASMRQQRqJBEgAQsgACMRQQRrJBEQNCMRIAA2AgAgACABOQMQIxFBBGokEQskAQF8IxFBBGskERA0IxEgADYCACAAKwMYIQEjEUEEaiQRIAELIAAjEUEEayQREDQjESAANgIAIAAgATkDGCMRQQRqJBELIgAjEUEEayQREDQjESAANgIAIAAtACAhACMRQQRqJBEgAAsgACMRQQRrJBEQNCMRIAA2AgAgACABOgAgIxFBBGokEQsiACMRQQRrJBEQNCMRIAA2AgAgAC0AISEAIxFBBGokESAACyAAIxFBBGskERA0IxEgADYCACAAIAE6ACEjEUEEaiQRCyIAIxFBBGskERA0IxEgADYCACAAKAIkIQAjEUEEaiQRIAALJgAjEUEIayQREDQjESAANgIAIxEgATYCBCAAIAEQJSMRQQhqJBELIgAjEUEEayQREDQjESAANgIAIAAoAighACMRQQRqJBEgAAsmACMRQQhrJBEQNCMRIAA2AgAjESABNgIEIAAgARAmIxFBCGokEQsiACMRQQRrJBEQNCMRIAA2AgAgACgCLCEAIxFBBGokESAACyYAIxFBCGskERA0IxEgADYCACMRIAE2AgQgACABECcjEUEIaiQRCyIAIxFBBGskERA0IxEgADYCACAAKAIwIQAjEUEEaiQRIAALJgAjEUEIayQREDQjESAANgIAIxEgATYCBCAAIAEQKSMRQQhqJBELKQAjEUEEayQREDQjESAANgIAIAAgASACIAMgBBA+IQAjEUEEaiQRIAALOAAjEUEQayQREDQjESAANgIAIxEgATYCBCMRIAI2AggjESADNgIMIAAgASACIAMQLCMRQRBqJBELKgAjEUEIayQREDQjESAANgIAIxEgATYCBCAAIAEQNyEAIxFBCGokESAAC2kAIxFBBGskERA0IxEgADYCACAAQQBBA0EDQbAQEDgQJSAAQQBBA0EDQdAQEDgQJiAAQQBBA0EDQfAQEDgQJyAAQZARECkgAEQAAAAAAADwfzkDECAARAAAAAAAAPD/OQMYIxFBBGokEQsL0QcuAEGMCAsBLABBmAgLIwEAAAAcAAAASQBuAHYAYQBsAGkAZAAgAGwAZQBuAGcAdABoAEG8CAsBLABByAgLIQEAAAAaAAAAfgBsAGkAYgAvAGEAcgByAGEAeQAuAHQAcwBB7AgLATwAQfgICy8BAAAAKAAAAEEAbABsAG8AYwBhAHQAaQBvAG4AIAB0AG8AbwAgAGwAYQByAGcAZQBBrAkLATwAQbgJCycBAAAAIAAAAH4AbABpAGIALwByAHQALwBpAHQAYwBtAHMALgB0AHMAQawKCwE8AEG4CgsrAQAAACQAAABJAG4AZABlAHgAIABvAHUAdAAgAG8AZgAgAHIAYQBuAGcAZQBB7AoLASwAQfgKCxsBAAAAFAAAAH4AbABpAGIALwByAHQALgB0AHMAQbwLCwE8AEHICwslAQAAAB4AAAB+AGwAaQBiAC8AcgB0AC8AdABsAHMAZgAuAHQAcwBB/AsLARwAQYgMCwkGAAAACAAAAAEAQZwMCwEcAEGoDAsJBgAAAAgAAAACAEG8DAsBfABByAwLZQEAAABeAAAARQBsAGUAbQBlAG4AdAAgAHQAeQBwAGUAIABtAHUAcwB0ACAAYgBlACAAbgB1AGwAbABhAGIAbABlACAAaQBmACAAYQByAHIAYQB5ACAAaQBzACAAaABvAGwAZQB5AEG8DQsBPABByA0LLQEAAAAmAAAAfgBsAGkAYgAvAGEAcgByAGEAeQBiAHUAZgBmAGUAcgAuAHQAcwBB/A0LATwAQYgOCy8BAAAAKAAAAGEAcwBzAGUAbQBiAGwAeQAvAGkAcwBvAHQAbwBuAGkAYwAuAHQAcwBBvA4LARwAQcgOCwkIAAAACAAAAAMAQdwOCwEcAEH8DgsBHABBnA8LARwAQbwPCwEcAEHIDwsJCgAAAAgAAAAEAEHcDwsBPABB6A8LKwEAAAAkAAAAfgBsAGkAYgAvAHQAeQBwAGUAZABhAHIAcgBhAHkALgB0AHMAQZwQCwEcAEG8EAsBHABB3BALARwAQfwQCwEcAEGIEQsJCgAAAAgAAAAFAEGcEQsBPABBqBELMQEAAAAqAAAATwBiAGoAZQBjAHQAIABhAGwAcgBlAGEAZAB5ACAAcABpAG4AbgBlAGQAQdwRCwE8AEHoEQsvAQAAACgAAABPAGIAagBlAGMAdAAgAGkAcwAgAG4AbwB0ACAAcABpAG4AbgBlAGQAQaASCw0MAAAAIAAAAAAAAAAgAEG8EgsSAhoAAAAAAAACQQAAAAAAAAIJAEHcEgsCCBoAQfwSCwUBGgAAAg==";

const initIsotonicRegression = (increasing) => {
  const wasmB64URL = 'data:application/octet-binary;base64,' + wasmB64;

  return loader.instantiate(
    fetch(wasmB64URL).then((result) => result.arrayBuffer()),
    {}
  ).then(({ exports }) => {
    const wasm = exports;
    const __pin = wasm.__pin;
    const __unpin = wasm.__unpin;
    const __newArray = wasm.__newArray;
    const __getArray = wasm.__getArray;

    class IsotonicRegression {
      // Store an instance of WASM IsotonicRegression
      iso;

      /**
       * Constructor for the class IsotonicRegression
       * @param {object} param0 Model configuration. It can have 4 fields:
       * 1. yMin {number} minimum value of y, default = -Infinity
       * 2. yMax {number} maximum value of y, default = Infinity
       * 3. increasing {bool} if true, fit an increasing isotonic regression, default = true
       * 4. clipOutOfBound {bool} if true, clip the out of bound x; otherwise predict null, default = true
       */
      constructor({ yMin = -Infinity, yMax = Infinity, increasing = true, clipOutOfBound = true } = {}) {
        this.iso = new wasm.__IsotonicRegression(yMin, yMax, increasing, clipOutOfBound);

        // Important to pin any WASM object created in JS
        // Since the runtime on the Wasm end does not know that a JS object keeps
        // the Wasm object alive
        __pin(this.iso);
      }

      /**
       * Fit an isotonic regression on the given x, y, w data.
       * @param {[number]} x x array
       * @param {[number]} y y array
       * @param {[number]} w weight array
       */
      fit(x, y, w = undefined) {
        // If sample weight is not given, replace them with [1, 1 ... 1]
        let sampleWeight = w;
        if (w === undefined) {
          sampleWeight = new Array(x.length).fill(1.0);
        }

        // Check the parameters
        this.__checkFitParam(x, y, sampleWeight);

        // Create arrays in WASM memory
        let xPtr = __pin(__newArray(wasm.xArrayID, x));
        let yPtr = __pin(__newArray(wasm.yArrayID, y));
        let wPtr = __pin(__newArray(wasm.wArrayID, sampleWeight));

        // Fit the Isotonic regression using WASM
        this.iso.fit(xPtr, yPtr, wPtr);

        // Unpin the pointers so they can get collected
        __unpin(xPtr);
        __unpin(yPtr);
        __unpin(wPtr);
      }


      /**
       * Use the trained isotonic regression model to predict on the new data
       * @param {[number]} newX new data array
       * @returns predictions, same size as `newX`
       */
      predict(newX) {
        // Pass newX to WASM to predict
        let newXPtr = __pin(__newArray(wasm.newXArrayID, newX));
        let predictedXPtr = this.iso.predict(newXPtr);
        let predictedXArray = __getArray(predictedXPtr);

        __unpin(newXPtr);
        return predictedXArray;
      }

      /**
       * Reset the learned weights of this isotonic regression model.
       */
      reset() {
        this.iso.reset();
      }

      /**
       * Run this function when the model is no longer needed. It is necessary because
       * WASM won't garbage collect the model until we manually __unpin() it from JS
       * (memory leak)
       */
      destroy() {
        __unpin(this.iso);
      }

      get xThresholds() {
        return __getArray(this.iso.xThresholds);
      }

      get yThresholds() {
        return __getArray(this.iso.yThresholds);
      }

      get xMin() {
        return this.iso.xMin;
      }

      get xMax() {
        return this.iso.xMax;
      }

      __checkFitParam(x, y, w) {
        if (x.length <= 1 || y.length <= 1 || w.length <= 1) {
          throw new Error('The length of input arrays should be greater than 1.');
        }

        if (x.length !== y.length) {
          throw new Error('The x array and y array should have the same length.');
        }
      }
    }

    let model = new IsotonicRegression({ increasing: increasing });
    return model;

  });
};

export { initIsotonicRegression };
