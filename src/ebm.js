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

const STRING_SMALLSIZE = 192; // break-even point in V8
const STRING_CHUNKSIZE = 1024; // mitigate stack overflow
const utf16 = new TextDecoder("utf-16le", { fatal: true }); // != wtf16

/** Gets a string from memory. */
function getStringImpl(buffer, ptr) {
  let len = new Uint32Array(buffer)[ptr + SIZE_OFFSET >>> 2] >>> 1;
  const wtf16 = new Uint16Array(buffer, ptr, len);
  if (len <= STRING_SMALLSIZE) return String.fromCharCode(...wtf16);
  try {
    return utf16.decode(wtf16);
  } catch {
    let str = "", off = 0;
    while (len - off > STRING_CHUNKSIZE) {
      str += String.fromCharCode(...wtf16.subarray(off, off += STRING_CHUNKSIZE));
    }
    return str + String.fromCharCode(...wtf16.subarray(off));
  }
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

class ConsoleImport {

  constructor() {

    this._exports = null;

    this.wasmImports = {
      consoleBindings: {
        _log: (message) => {

          console.log(this._exports.__getString(message));

        }
      }
    };
  }

  get wasmExports() {
    return this._exports
  }
  set wasmExports(e) {
    this._exports = e;
  }

  getFn(fnIndex) {
    if (!this.wasmExports)
      throw new Error(
        'Make sure you set .wasmExports after instantiating the Wasm module but before running the Wasm module.',
      )
    return this._exports.table.get(fnIndex)
  }
}

var wasmB64 = "AGFzbQEAAAABlwEXYAJ/fwBgAX8Bf2ACf38Bf2ADf39/AGABfwBgAn9/AXxgBH9/f38AYAF/AXxgAABgA39/fwF/YAJ/fAF/YAABf2ABfAF/YAN/f3wAYAF8AXxgAn98AGAOf39/f39/fH9/f39/f38Bf2ADf398AX9gBn5/fn9+fwF/YAJ8fwF8YAJ8fAF8YAd/f3x8fHx8AGAEf39/fwF/AjADA2VudgVhYm9ydAAGD2NvbnNvbGVCaW5kaW5ncwRfbG9nAAQDZW52BXRyYWNlABUDugG4AQUKAAQBAwQDAAAAAAAAAAAAAAgABAAAAwgLAgIAAgoAAAAAAwIDAwMAAQkAAQEKAwEDARIJDAwCAQANDQACAxMOFA4AAgUPBQUAAgAFBwEECAQEBAgIAgQQAgYGBgIBBwECCQABAQQBAQcBAQIBAQMLARYLCREBAQoBAAEAAQABAAEABw8BAAEAAQABAAEAAQABAAEAAQABAAEAAQABABACAgYGBgEBAgIBCQABBQUFAgEBBwcFEQcEBAFwAAIFAwEAAQaLARt/AEEDC38AQQQLfwBBBQt/AEEGC38AQQcLfwBBCAt/AEEJC38BQQALfwFBAAt/AUEAC38BQQALfwFBAAt/AUEAC38BQQALfwFBAAt/AUEAC38BQQALfgFCAAt+AUIAC38BQQALfwFBAAt+AUIAC38BQQALfwFBAAt/AEEKC38AQcAkC38BQcSlAQsH0g5PBV9fRUJNAxgNSW50MzJBcnJheV9JRAMAD0ludDMyQXJyYXkyRF9JRAMBD0Zsb2F0NjRBcnJheV9JRAMCEUZsb2F0NjRBcnJheTJEX0lEAwMRRmxvYXQ2NEFycmF5M0RfSUQDBA5TdHJpbmdBcnJheV9JRAMFEFN0cmluZ0FycmF5MkRfSUQDBgVfX25ldwAgBV9fcGluAFEHX191bnBpbgBSCV9fY29sbGVjdABTC19fcnR0aV9iYXNlAxkGbWVtb3J5AgAUX19zZXRBcmd1bWVudHNMZW5ndGgAVhZzZWFyY2hTb3J0ZWRMb3dlckluZGV4AHsWX19FQk0jZ2V0OmZlYXR1cmVOYW1lcwB8Fl9fRUJNI3NldDpmZWF0dXJlTmFtZXMAfRZfX0VCTSNnZXQ6ZmVhdHVyZVR5cGVzAH4WX19FQk0jc2V0OmZlYXR1cmVUeXBlcwB/El9fRUJNI2dldDpiaW5FZGdlcwCAARJfX0VCTSNzZXQ6YmluRWRnZXMAgQEQX19FQk0jZ2V0OnNjb3JlcwCCARBfX0VCTSNzZXQ6c2NvcmVzAIMBFl9fRUJNI2dldDpoaXN0QmluRWRnZXMAhAEWX19FQk0jc2V0Omhpc3RCaW5FZGdlcwCFARNfX0VCTSNnZXQ6aW50ZXJjZXB0AIYBE19fRUJNI3NldDppbnRlcmNlcHQAhwEcX19FQk0jZ2V0OmludGVyYWN0aW9uSW5kZXhlcwCIARxfX0VCTSNzZXQ6aW50ZXJhY3Rpb25JbmRleGVzAIkBG19fRUJNI2dldDppbnRlcmFjdGlvblNjb3JlcwCKARtfX0VCTSNzZXQ6aW50ZXJhY3Rpb25TY29yZXMAiwEdX19FQk0jZ2V0OmludGVyYWN0aW9uQmluRWRnZXMAjAEdX19FQk0jc2V0OmludGVyYWN0aW9uQmluRWRnZXMAjQERX19FQk0jZ2V0OnNhbXBsZXMAjgERX19FQk0jc2V0OnNhbXBsZXMAjwEQX19FQk0jZ2V0OmxhYmVscwCQARBfX0VCTSNzZXQ6bGFiZWxzAJEBHV9fRUJNI2dldDplZGl0aW5nRmVhdHVyZUluZGV4AJIBHV9fRUJNI3NldDplZGl0aW5nRmVhdHVyZUluZGV4AJMBGl9fRUJNI2dldDppc0NsYXNzaWZpY2F0aW9uAJQBGl9fRUJNI3NldDppc0NsYXNzaWZpY2F0aW9uAJUBFF9fRUJNI2dldDpwcmVkTGFiZWxzAJYBFF9fRUJNI3NldDpwcmVkTGFiZWxzAJcBE19fRUJNI2dldDpwcmVkUHJvYnMAmAETX19FQk0jc2V0OnByZWRQcm9icwCZASFfX0VCTSNnZXQ6ZWRpdGluZ0ZlYXR1cmVTYW1wbGVNYXAAmgEhX19FQk0jc2V0OmVkaXRpbmdGZWF0dXJlU2FtcGxlTWFwAJsBIl9fRUJNI2dldDplZGl0aW5nRmVhdHVyZVNhbXBsZU1hcHMAnAEiX19FQk0jc2V0OmVkaXRpbmdGZWF0dXJlU2FtcGxlTWFwcwCdARdfX0VCTSNnZXQ6aGlzdEJpbkNvdW50cwCeARdfX0VCTSNzZXQ6aGlzdEJpbkNvdW50cwCfARhfX0VCTSNnZXQ6c2xpY2VTYW1wbGVJRHMAoAEYX19FQk0jc2V0OnNsaWNlU2FtcGxlSURzAKEBEV9fRUJNI2NvbnN0cnVjdG9yAKIBGl9fRUJNI2dldFNlbGVjdGVkU2FtcGxlTnVtAKMBG19fRUJNI2dldFNlbGVjdGVkU2FtcGxlRGlzdACkARFfX0VCTSN1cGRhdGVNb2RlbAClAR1fX0VCTSN1cGRhdGVQcmVkaWN0aW9uUGFydGlhbACmAQ5fX0VCTSNzZXRNb2RlbACnARNfX0VCTSNnZXRQcmVkaWN0aW9uAKgBEF9fRUJNI2dldE1ldHJpY3MAqQEhX19FQk0jZ2V0TWV0cmljc09uU2VsZWN0ZWRTYW1wbGVzAKoBHl9fRUJNI2dldE1ldHJpY3NPblNlbGVjdGVkQmlucwCrAR9fX0VCTSNnZXRNZXRyaWNzT25TZWxlY3RlZFNsaWNlAKwBEl9fRUJNI3NldFNsaWNlRGF0YQCtARdfX0VCTSNzZXRFZGl0aW5nRmVhdHVyZQCuAQ9fX0VCTSNwcmludE5hbWUArwEUcm9vdE1lYW5TcXVhcmVkRXJyb3IAsAERbWVhbkFic29sdXRlRXJyb3IAsQEbbWVhbkFic29sdXRlUGVyY2VudGFnZUVycm9yALIBEGNvdW50QnlUaHJlc2hvbGQAswELZ2V0Uk9DQ3VydmUAtAEKZ2V0UFJDdXJ2ZQC1AQlnZXRST0NBdWMAtgETZ2V0QXZlcmFnZVByZWNpc2lvbgC3AQtnZXRBY2N1cmFjeQC4ARJnZXRDb25mdXNpb25NYXRyaXgAuQETZ2V0QmFsYW5jZWRBY2N1cmFjeQC6AQgBVwkHAQBBAQsBTQqZygG4ASkAIAEgACgCDE8EQEHACEGACUHjAEEqEAAACyAAKAIEIAFBA3RqKwMAC3UBA38gACgCDEEBayEDA0AgAyAEa0EBSgRAIAAgBLcgAyAEa0ECbbecoKoiAhADIAFjBEAgAiEEBSAAIAIQAyABZEUEQCACDwsgAiEDCwwBCwsgACADEAMgAWUEQCADDwsgACAEEAMgAWQEQCAEDwsgA0EBawsSACAAIAEgACgCBEEDcXI2AgQLWAEBfyAAKAIEQXxxIgFFBEBBACAAQcSlAUkgACgCCBtFBEBBAEGwCUH/AEESEAAACw8LIAAoAggiAEUEQEEAQbAJQYMBQRAQ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QcSlAWtBAXYkDEGgCxAHJA5BwAsQByQPCxoAIxpBxCVIBEBB4KUBQZCmAUEBQQEQAAALC/MBAQR/IxpBDGskGhBYIxpCADcDACMaQQA2AgggAUEBayICQQBIBEAjGkEMaiQaQaAPDwsgAkUEQCMaIAAoAgAiADYCACMaQQxqJBogAEGgDyAAGw8LQaAPIQEjGkGgDzYCBEGcDygCAEEBdiEFA0AgAiADSgRAIxogACADQQJ0aigCACIENgIAIAQEQCMaIAQ2AggjGiABIAQQOiIBNgIECyAFBEAjGiABQaAPEDoiATYCBAsgA0EBaiEDDAELCyMaIAAgAkECdGooAgAiADYCACAABEAjGiAANgIIIxogASAAEDoiATYCBAsjGkEMaiQaIAELkAEBAX8jGkEEayQaEFgjGkEANgIAIxpBDGskGhBYIxpCADcDACMaQQA2AggjGkGgDzYCACMaEHMiATYCBCMaQbAbNgIAQbAbQQEgABAyIxpBsBs2AgAjGkGgDzYCCEGwGxA7IQAjGiAANgIAIAEgABA8IAEQdCEAIxpBDGokGiMaIAA2AgAgABABIxpBBGokGguuEAIBfwF8IxpBKGskGhBYIxpCADcDACMaQgA3AwgjGkIANwMQIxpCADcDGCMaQgA3AyAgAEUEQCMaQdQAQQoQICIANgIACyAAQQAQCyAAQQAQDCAAQQAQDSAAQQAQDiAAQQAQDyAARAAAAAAAAAAAOQMYIABBABAQIABBABASIABBABARIABBABATIABBABAUIABBADYCNCAAQQA6ADggAEEAECIgAEEAECMgAEEAECQgAEEAECsgAEEAECUgAEEAEEYgACABEAsgACACEAwgACADEA0gACAEEA4gACAFEA8gACAGOQMYIAAgBxAQIAAgCBARIAAgCRASIAAgChATIAAgCxAUIAAgDDYCNCAAIA06ADgjGiAAKAIwIgE2AgggASgCDBBtIQEjGiABNgIEIAAgASAAKwMYECEQIiMaIAAoAjwiATYCCCABKAIMEG0hASMaIAE2AgQgACABRAAAAAAAAAAAECEQIyMaIAAoAggiATYCCCABIAAoAjQQbyEBIxogATYCBCAAIAEoAgwQbhAkIxogACgCECIBNgIEIAAgASgCDBBuECUDQCMaIAAoAggiATYCCCABIAAoAjQQbyEBIxogATYC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IxpCADcDACMaIQIgABB5IQAjGiAANgIAIAIgABB6IgI2AgQDQCABIAIoAgxBAWtIBEAgAiABEG8hACMaIAA2AgAgAEEBEAMhBCACIAFBAWoiABBvIQMjGiADNgIAIAQgA0EBEAOhIQQgAiABEG8hASMaIAE2AgAgBSAEIAFBABADoqAhBSAAIQEMAQsLIxpBCGokGiAFC5kBAQN/IxpBCGskGhBYIxpCADcDACMaQRBBBRAgIgE2AgAgAUEAEAsgAUEANgIEIAFBADYCCCABQQA2AgwgAEH///8/SwRAQcAKQYAJQcAAQTwQAAALIxogAEEIIABBCEsbQQN0IgNBABAgIgI2AgQgAiADEB8gASACEAsgASACNgIEIAEgAzYCCCABIAA2AgwjGkEIaiQaIAELmgEBA38jGkEIayQaEFgjGkIANwMAIxpBEEEEECAiATYCACABQQAQCyABQQA2AgQgAUEANgIIIAFBADYCDCAAQf////8ASwRAQcAKQYAJQcAAQTwQAAALIxogAEEIIABBCEsbQQJ0IgNBABAgIgI2AgQgAiADEB8gASACEAsgASACNgIEIAEgAzYCCCABIAA2AgwjGkEIaiQaIAELXQAjGkEEayQaEFgjGkEANgIAIAEgACgCDE8EQEHACEGACUHjAEEqEAAACyMaIAAoAgQgAUECdGooAgAiADYCACAARQRAQbAMQYAJQecAQSgQAAALIxpBBGokGiAAC5oBAQN/IxpBCGskGhBYIxpCADcDACMaQRBBAxAgIgE2AgAgAUEAEAsgAUEANgIEIAFBADYCCCABQQA2AgwgAEH/////AEsEQEHACkGACUHAAEE8EAAACyMaIABBCCAAQQhLG0ECdCIDQQAQICICNgIEIAIgAxAfIAEgAhALIAEgAjYCBCABIAM2AgggASAANgIMIxpBCGokGiABC0kBAX8jGkEEayQaEFgjGkEANgIAIABB/P///wNLBEBBwApBsA1BMUErEAAACyMaIABBABAgIgE2AgAgASAAEB8jGkEEaiQaIAEL2wEBA38jGkEEayQaEFgjGkEANgIAIAAgASABECwiBBAtIgMEQCADIAI2AgQgACACQQEQCgUgACgCECAAKAIMRgRAIAAgACgCFCAAKAIMQQNsQQRtSAR/IAAoAgQFIAAoAgRBAXRBAXILEC4LIxogACgCCCIDNgIAIAAgACgCECIFQQFqNgIQIAMgBUEMbGoiAyABNgIAIAMgAjYCBCAAIAJBARAKIAAgACgCFEEBajYCFCADIAAoAgAgBCAAKAIEcUECdGoiACgCADYCCCAAIAM2AgALIxpBBGokGgt1AQJ/IxpBBGskGhBYIxpBADYCACMaQQhBDRAgIgA2AgAgAEEAEAsgAEEANgIEIABBnA8oAgBBAXZBAXQiAUHAACABQcAASxtBABAgEAsgAQRAIAAoAgBBoA8gARAmIAAgASAAKAIEajYCBAsjGkEEaiQaIAALSwECfyMaQQRrJBoQWCMaQQA2AgAgACgCBCIBRQRAIxpBBGokGkGgDw8LIxogAUEBECAiAjYCACACIAAoAgAgARAmIxpBBGokGiACC3EBAn8jGkEEayQaEFgjGkEANgIAIxoCfyAAIAF0IgQhBSAEQQAQICEBIAMEQCABIAMgBRAmCyABIgMLNgIAQRAgAhAgIgEgAzYCACABIANBABAKIAEgAzYCBCABIAQ2AgggASAANgIMIxpBBGokGiABC3MBAn8jGkEIayQaEFgjGkIANwMAIxpBEEEHECAiADYCACAAQQAQCyAAQQA2AgQgAEEANgIIIABBADYCDCMaQSBBABAgIgE2AgQgAUEgEB8gACABEAsgACABNgIEIABBIDYCCCAAQQA2AgwjGkEIaiQaIAALnwEBAX8jGkEEayQaEFgjGkEANgIAIAAoAgwhAyABQQBIBH8gASADaiIBQQAgAUEAShsFIAEgAyABIANIGwshASMaIAJBAEgEfyACIANqIgJBACACQQBKGwUgAiADIAIgA0gbCyABayICQQAgAkEAShsiA0EDQQVBABB1IgI2AgAgAigCBCAAKAIEIAFBA3RqIANBA3QQJiMaQQRqJBogAgvmAQICfwF8IxpBBGskGhBYIxpBADYCACMaQQRBA0EFQcAfEHUiAzYCAANAIAQgACgCDEgEQEQAAAAAAADwP0QAAAAAAAAAACABIAQQAyACZhsiBUQAAAAAAADwP2EEQCAAIAQQAyAFYQRAIANBAyADQQMQA0QAAAAAAADwP6AQPgUgA0EBIANBARADRAAAAAAAAPA/oBA+CwUgACAEEAMgBWEEQCADQQAgA0EAEANEAAAAAAAA8D+gED4FIANBAiADQQIQA0QAAAAAAADwP6AQPgsLIARBAWohBAwBCwsjGkEEaiQaIAMLmwEBBX8jGkEEayQaEFgjGkEANgIAQQAgACgCDCIBIAFBAEobIQIjGiABIAJrIgFBACABQQBKGyIDQQJBBkEAEHUiATYCACABKAIEIQQgACgCBCACQQJ0aiECQQAhACADQQJ0IQMDQCAAIANJBEAgACAEaiAAIAJqKAIAIgU2AgAgASAFQQEQCiAAQQRqIQAMAQsLIxpBBGokGiABC3YBA38jGkEEayQaEFgjGkEANgIAIAAoAgwiAQRAIAAoAgQhAiAAKAIEIAFBAWtBAnRqIQEDQCABIAJLBEAjGiACKAIAIgM2AgAgAiABKAIANgIAIAEgAzYCACACQQRqIQIgAUEEayEBDAELCwsjGkEEaiQaIAALIwAjGkEEayQaEFgjGiAANgIAIAAgARAEIQAjGkEEaiQaIAALIgAjGkEEayQaEFgjGiAANgIAIAAoAgAhACMaQQRqJBogAAsmACMaQQhrJBoQWCMaIAA2AgAjGiABNgIEIAAgARALIxpBCGokGgsiACMaQQRrJBoQWCMaIAA2AgAgACgCBCEAIxpBBGokGiAACyYAIxpBCGskGhBYIxogADYCACMaIAE2AgQgACABEAwjGkEIaiQaCyIAIxpBBGskGhBYIxogADYCACAAKAIIIQAjGkEEaiQaIAALJgAjGkEIayQaEFgjGiAANgIAIxogATYCBCAAIAEQDSMaQQhqJBoLIgAjGkEEayQaEFgjGiAANgIAIAAoAgwhACMaQQRqJBogAAsmACMaQQhrJBoQWCMaIAA2AgAjGiABNgIEIAAgARAOIxpBCGokGgsiACMaQQRrJBoQWCMaIAA2AgAgACgCECEAIxpBBGokGiAACyYAIxpBCGskGhBYIxogADYCACMaIAE2AgQgACABEA8jGkEIaiQaCyQBAXwjGkEEayQaEFgjGiAANgIAIAArAxghASMaQQRqJBogAQsgACMaQQRrJBoQWCMaIAA2AgAgACABOQMYIxpBBGokGgsiACMaQQRrJBoQWCMaIAA2AgAgACgCICEAIxpBBGokGiAACyYAIxpBCGskGhBYIxogADYCACMaIAE2AgQgACABEBAjGkEIaiQaCyIAIxpBBGskGhBYIxogADYCACAAKAIkIQAjGkEEaiQaIAALJgAjGkEIayQaEFgjGiAA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";

const Console = new ConsoleImport();
const imports = { ...Console.wasmImports };


const initEBM = (_featureData, _sampleData, _editingFeature, _isClassification) => {
  const wasmB64URL = 'data:application/octet-binary;base64,' + wasmB64;

  return loader.instantiate(
    fetch(wasmB64URL).then((result) => result.arrayBuffer()),
    imports
  ).then(({ exports }) => {
    Console.wasmExports = exports;
    const wasm = exports;
    const __pin = wasm.__pin;
    const __unpin = wasm.__unpin;
    const __newArray = wasm.__newArray;
    const __getArray = wasm.__getArray;
    const __newString = wasm.__newString;
    const __getString = wasm.__getString;

    /**
     * Convert a JS string array to pointer of string pointers in AS
     * @param {[string]} strings String array
     * @returns Pointer to the array of string pointers
     */
    const __createStringArray = (strings) => {
      let stringPtrs = strings.map(str => __pin(__newString(str)));
      let stringArrayPtr = __pin(__newArray(wasm.StringArray_ID, stringPtrs));
      stringPtrs.forEach(ptr => __unpin(ptr));

      return stringArrayPtr;
    };

    /**
     * Utility function to free a 2D array
     * @param {[[object]]} array2d 2D array
     */
    const __unpin2DArray = (array2d) => {
      for (let i = 0; i < array2d.length; i++) {
        __unpin(array2d[i]);
      }
      __unpin(array2d);
    };

    /**
     * Utility function to free a 3D array
     * @param {[[[object]]]} array2d 3D array
     */
    const __unpin3DArray = (array3d) => {
      for (let i = 0; i < array3d.length; i++) {
        for (let j = 0; j < array3d[i].length; j++) {
          __unpin(array3d[i][j]);
        }
        __unpin(array3d[i]);
      }
      __unpin(array3d);
    };

    class EBM {
      // Store an instance of WASM EBM
      ebm;
      sampleDataNameMap;
      editingFeatureIndex;
      editingFeatureName;

      constructor(featureData, sampleData, editingFeature, isClassification) {

        // Store values for JS object
        this.isClassification = isClassification;

        /**
         * Pre-process the feature data
         *
         * Feature data includes the main effect and also the interaction effect, and
         * we want to split those two.
         */

        // Step 1: For the main effect, we only need bin edges and scores stored with the same order
        // of `featureNames` and `featureTypes`.

        // Create an index map from feature name to their index in featureData
        let featureDataNameMap = new Map();
        featureData.features.forEach((d, i) => featureDataNameMap.set(d.name, i));

        this.sampleDataNameMap = new Map();
        sampleData.featureNames.forEach((d, i) => this.sampleDataNameMap.set(d, i));

        let featureNamesPtr = __createStringArray(sampleData.featureNames);
        let featureTypesPtr = __createStringArray(sampleData.featureTypes);

        let editingFeatureIndex = this.sampleDataNameMap.get(editingFeature);
        this.editingFeatureIndex = editingFeatureIndex;
        this.editingFeatureName = editingFeature;

        // Create two 2D arrays for binEdge ([feature, bin]) and score ([feature, bin]) respectively
        // We mix continuous and categorical together (assume the categorical features
        // have been encoded)
        let binEdges = [];
        let scores = [];


        // We also pass the histogram edges (defined by InterpretML) to WASM. We use
        // WASM EBM to count bin size based on the test set, so that we only iterate
        // the test data once.
        let histBinEdges = [];

        // This loop won't encounter interaction terms
        for (let i = 0; i < sampleData.featureNames.length; i++) {
          let curName = sampleData.featureNames[i];
          let curIndex = featureDataNameMap.get(curName);

          let curScore = featureData.features[curIndex].additive.slice();
          let curBinEdge;
          let curHistBinEdge;

          if (sampleData.featureTypes[i] === 'categorical') {
            curBinEdge = featureData.features[curIndex].binLabel.slice();
            curHistBinEdge = featureData.features[curIndex].histEdge.slice();
          } else {
            curBinEdge = featureData.features[curIndex].binEdge.slice(0, -1);
            curHistBinEdge = featureData.features[curIndex].histEdge.slice(0, -1);
          }

          // Pin the inner 1D arrays
          let curBinEdgePtr = __pin(__newArray(wasm.Float64Array_ID, curBinEdge));
          let curScorePtr = __pin(__newArray(wasm.Float64Array_ID, curScore));
          let curHistBinEdgesPtr = __pin(__newArray(wasm.Float64Array_ID, curHistBinEdge));

          binEdges.push(curBinEdgePtr);
          scores.push(curScorePtr);
          histBinEdges.push(curHistBinEdgesPtr);
        }

        // Pin the 2D arrays
        const binEdgesPtr = __pin(__newArray(wasm.Float64Array2D_ID, binEdges));
        const scoresPtr = __pin(__newArray(wasm.Float64Array2D_ID, scores));
        const histBinEdgesPtr = __pin(__newArray(wasm.Float64Array2D_ID, histBinEdges));

        /**
         * Step 2: For the interaction effect, we want to store the feature
         * indexes and the score.
         *
         * Here we store arrays of indexes(2D), edges(3D), and scores(3D)
         */
        let interactionIndexes = [];
        let interactionScores = [];
        let interactionBinEdges = [];

        featureData.features.forEach((d) => {
          if (d.type === 'interaction') {
            // Parse the feature name
            let index1 = sampleData.featureNames.indexOf(d.name1);
            let index2 = sampleData.featureNames.indexOf(d.name2);

            let curIndexesPtr = __pin(__newArray(wasm.Int32Array_ID, [index1, index2]));
            interactionIndexes.push(curIndexesPtr);

            // Collect two bin edges
            let binEdge1Ptr;
            let binEdge2Ptr;

            // Have to skip the max edge if it is continuous
            if (sampleData.featureTypes[index1] === 'categorical') {
              binEdge1Ptr = __pin(__newArray(wasm.Float64Array_ID, d.binLabel1.slice()));
            } else {
              binEdge1Ptr = __pin(__newArray(wasm.Float64Array_ID, d.binLabel1.slice(0, -1)));
            }

            if (sampleData.featureTypes[index2] === 'categorical') {
              binEdge2Ptr = __pin(__newArray(wasm.Float64Array_ID, d.binLabel2.slice()));
            } else {
              binEdge2Ptr = __pin(__newArray(wasm.Float64Array_ID, d.binLabel2.slice(0, -1)));
            }

            let curBinEdgesPtr = __pin(__newArray(wasm.Float64Array2D_ID, [binEdge1Ptr, binEdge2Ptr]));

            interactionBinEdges.push(curBinEdgesPtr);

            // Add the scores
            let curScore2D = d.additive.map((a) => {
              let aPtr = __pin(__newArray(wasm.Float64Array_ID, a));
              return aPtr;
            });
            let curScore2DPtr = __pin(__newArray(wasm.Float64Array2D_ID, curScore2D));
            interactionScores.push(curScore2DPtr);
          }
        });

        // Create 3D arrays
        let interactionIndexesPtr = __pin(__newArray(wasm.Int32Array2D_ID, interactionIndexes));
        let interactionBinEdgesPtr = __pin(__newArray(wasm.Float64Array3D_ID, interactionBinEdges));
        let interactionScoresPtr = __pin(__newArray(wasm.Float64Array3D_ID, interactionScores));

        /**
         * Step 3: Pass the sample data to WASM. We directly transfer this 2D float
         * array to WASM (assume categorical features are encoded already)
         */
        let samples = sampleData.samples.map((d) => __pin(__newArray(wasm.Float64Array_ID, d)));
        let samplesPtr = __pin(__newArray(wasm.Float64Array2D_ID, samples));
        let labelsPtr = __pin(__newArray(wasm.Float64Array_ID, sampleData.labels));

        /**
         * Step 4: Initialize the EBM in WASM
         */
        this.ebm = wasm.__EBM(
          featureNamesPtr,
          featureTypesPtr,
          binEdgesPtr,
          scoresPtr,
          histBinEdgesPtr,
          featureData.intercept,
          interactionIndexesPtr,
          interactionBinEdgesPtr,
          interactionScoresPtr,
          samplesPtr,
          labelsPtr,
          editingFeatureIndex,
          isClassification
        );
        __pin(this.ebm);

        /**
         * Step 5: free the arrays created to communicate with WASM
         */
        __unpin(labelsPtr);
        __unpin2DArray(samplesPtr);
        __unpin3DArray(interactionScoresPtr);
        __unpin3DArray(interactionBinEdgesPtr);
        __unpin2DArray(interactionIndexesPtr);
        __unpin2DArray(histBinEdgesPtr);
        __unpin2DArray(scoresPtr);
        __unpin2DArray(binEdgesPtr);
        __unpin(featureTypesPtr);
        __unpin(featureNamesPtr);
      }

      /**
       * Free the ebm wasm memory.
       */
      destroy() {
        __unpin(this.ebm);
        this.ebm = null;
      }

      printData() {
        let namePtr = this.ebm.printName();
        let name = __getString(namePtr);
        console.log('Editing: ', name);
      }

      /**
       * Get the current predicted probabilities
       * @returns Predicted probabilities
       */
      getProb() {
        let predProbs = __getArray(this.ebm.getPrediction());
        return predProbs;
      }

      /**
       * Get the current predictions (logits for classification or continuous values
       * for regression)
       * @returns predictions
       */
      getScore() {
        return __getArray(this.ebm.predLabels);
      }

      /**
       * Get the binary classification results
       * @returns Binary predictions
       */
      getPrediction() {
        if (this.isClassification) {
          let predProbs = __getArray(this.ebm.getPrediction());
          return predProbs.map(d => (d >= 0.5 ? 1 : 0));
        }
        return __getArray(this.ebm.getPrediction());
      }

      /**
       * Get the number of test samples affected by the given binIndexes
       * @param {[int]} binIndexes Indexes of bins
       * @returns {int} number of samples
       */
      getSelectedSampleNum(binIndexes) {
        let binIndexesPtr = __pin(__newArray(wasm.Int32Array_ID, binIndexes));
        let count = this.ebm.getSelectedSampleNum(binIndexesPtr);
        __unpin(binIndexesPtr);
        return count;
      }

      /**
       * Get the distribution of the samples affected by the given inIndexes
       * @param {[int]} binIndexes Indexes of bins
       * @returns [[int]] distributions of different bins
       */
      getSelectedSampleDist(binIndexes) {
        let binIndexesPtr = __pin(__newArray(wasm.Int32Array_ID, binIndexes));
        let histBinCounts = __getArray(this.ebm.getSelectedSampleDist(binIndexesPtr));
        histBinCounts = histBinCounts.map(p => __getArray(p));
        __unpin(binIndexesPtr);
        return histBinCounts;
      }

      /**
       * Get the histogram from the training data (from EBM python code)
       * @returns histogram of all bins
       */
      getHistBinCounts() {
        let histBinCounts = __getArray(this.ebm.histBinCounts);
        histBinCounts = histBinCounts.map(p => __getArray(p));
        return histBinCounts;
      }

      /**
       * Change the currently editing feature. If this feature has not been edited
       * before, EBM wasm internally creates a bin-sample mapping for it.
       * Need to call this function before update() or set() ebm on any feature.
       * @param {string} featureName Name of the editing feature
       */
      setEditingFeature(featureName) {
        let featureIndex = this.sampleDataNameMap.get(featureName);
        this.ebm.setEditingFeature(featureIndex);
        this.editingFeatureName = featureName;
        this.editingFeatureIndex = this.sampleDataNameMap.get(featureName);
      }

      /**
       * Change the scores of some bins of a feature.
       * This function assumes setEditingFeature(featureName) has been called once
       * @param {[int]} changedBinIndexes Indexes of bins
       * @param {[float]} changedScores Target scores for these bins
       * @param {string} featureName Name of the feature to update
       */
      updateModel(changedBinIndexes, changedScores, featureName = undefined) {
        // Get the feature index based on the feature name if it is specified
        let featureIndex = this.editingFeatureIndex;
        if (featureName !== undefined) {
          featureIndex = this.sampleDataNameMap.get(featureName);
        }

        let changedBinIndexesPtr = __pin(__newArray(wasm.Int32Array_ID, changedBinIndexes));
        let changedScoresPtr = __pin(__newArray(wasm.Float64Array_ID, changedScores));

        this.ebm.updateModel(changedBinIndexesPtr, changedScoresPtr, featureIndex);

        __unpin(changedBinIndexesPtr);
        __unpin(changedScoresPtr);
      }

      /**
       * Overwrite the whole bin definition for some continuous feature
       * This function assumes setEditingFeature(featureName) has been called once
       * @param {[int]} changedBinIndexes Indexes of all new bins
       * @param {[float]} changedScores Target scores for these bins
       * @param {string} featureName Name of the feature to overwrite
       */
      setModel(newBinEdges, newScores, featureName = undefined) {
        // Get the feature index based on the feature name if it is specified
        let featureIndex = this.editingFeatureIndex;
        if (featureName !== undefined) {
          featureIndex = this.sampleDataNameMap.get(featureName);
        }

        let newBinEdgesPtr = __pin(__newArray(wasm.Float64Array_ID, newBinEdges));
        let newScoresPtr = __pin(__newArray(wasm.Float64Array_ID, newScores));

        this.ebm.setModel(newBinEdgesPtr, newScoresPtr, featureIndex);

        __unpin(newBinEdgesPtr);
        __unpin(newScoresPtr);
      }

      /**
       * Get the metrics
       * @returns {object}
       */
      getMetrics() {

        /**
         * (1) regression: [[[RMSE, MAE]]]
         * (2) binary classification: [roc 2D points, [confusion matrix 1D],
         *  [[accuracy, roc auc, balanced accuracy]]]
         */

        // Unpack the return value from getMetrics()
        let metrics = {};
        if (!this.isClassification) {
          let result3D = __getArray(this.ebm.getMetrics());
          let result3DPtr = __pin(result3D);

          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.rmse = result1D[0];
          metrics.mae = result1D[1];
          metrics.mape = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);
          __unpin(result3DPtr);
        } else {
          // Unpack ROC curves
          let result3D = __getArray(this.ebm.getMetrics());
          let result3DPtr = __pin(result3D);

          // let result1DPtrs = [];
          // let roc2D = __getArray(result3D[0]);
          // let result2DPtr = __pin(roc2D);

          // let rocPoints = roc2D.map(d => {
          //   let point = __getArray(d);
          //   result1DPtrs.push(__pin(point));
          //   return point;
          // });

          // metrics.rocCurve = rocPoints;
          // result1DPtrs.map(d => __unpin(d));
          // __unpin(result2DPtr);

          // Unpack PR curves
          // result1DPtrs = [];
          // let pr2D = __getArray(result3D[1]);
          // result2DPtr = __pin(roc2D);

          // let prPoints = pr2D.map(d => {
          //   let point = __getArray(d);
          //   result1DPtrs.push(__pin(point));
          //   return point;
          // });

          // metrics.prCurve = prPoints;
          // result1DPtrs.map(d => __unpin(d));
          // __unpin(result2DPtr);

          // Unpack confusion matrix
          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.confusionMatrix = result1D;

          __unpin(result1DPtr);
          __unpin(result2DPtr);

          // Unpack summary statistics
          result2D = __getArray(result3D[1]);
          result2DPtr = __pin(result2D);

          result1D = __getArray(result2D[0]);
          result1DPtr = __pin(result1D);

          metrics.accuracy = result1D[0];
          metrics.rocAuc = result1D[1];
          metrics.balancedAccuracy = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);

          __unpin(result3DPtr);
        }

        // let metrics = __getArray(this.ebm.getMetrics());
        return metrics;
      }

      /**
       * Get the metrics on the selected bins
       * @param {[int]} binIndexes Indexes of selected bins
       * @returns {object}
       */
      getMetricsOnSelectedBins(binIndexes) {
        let metrics = {};

        // Handle binIndexes empty array case at the JS interface
        if (binIndexes.length === 0) {
          if (!this.isClassification) {
            metrics.rmse = null;
            metrics.mae = null;
            metrics.mape = null;
          } else {
            metrics.confusionMatrix = [null, null, null, null];
            metrics.accuracy = null;
            metrics.rocAuc = null;
            metrics.balancedAccuracy = null;
          }
          return metrics;
        }

        let binIndexesPtr = __pin(__newArray(wasm.Int32Array_ID, binIndexes));

        /**
         * (1) regression: [[[RMSE, MAE]]]
         * (2) binary classification: [roc 2D points, [confusion matrix 1D],
         *  [[accuracy, roc auc, balanced accuracy]]]
         */

        // Unpack the return value from getMetrics()
        if (!this.isClassification) {
          let result3D = __getArray(this.ebm.getMetricsOnSelectedBins(binIndexesPtr));
          let result3DPtr = __pin(result3D);

          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.rmse = result1D[0];
          metrics.mae = result1D[1];
          metrics.mape = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);
          __unpin(result3DPtr);
        } else {
          // Unpack ROC curves
          let result3D = __getArray(this.ebm.getMetricsOnSelectedBins(binIndexesPtr));
          let result3DPtr = __pin(result3D);

          // Unpack confusion matrix
          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.confusionMatrix = result1D;

          __unpin(result1DPtr);
          __unpin(result2DPtr);

          // Unpack summary statistics
          result2D = __getArray(result3D[1]);
          result2DPtr = __pin(result2D);

          result1D = __getArray(result2D[0]);
          result1DPtr = __pin(result1D);

          metrics.accuracy = result1D[0];
          metrics.rocAuc = result1D[1];
          metrics.balancedAccuracy = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);
          __unpin(result3DPtr);
        }
        __unpin(binIndexesPtr);

        return metrics;
      }

      /**
       * Get the metrics on the selected slice
       * This function assumes setSliceData() has been called
       * @returns {object}
       */
      getMetricsOnSelectedSlice() {
        // Unpack the return value from getMetrics()
        let metrics = {};
        if (!this.isClassification) {
          let result3D = __getArray(this.ebm.getMetricsOnSelectedSlice());
          let result3DPtr = __pin(result3D);

          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.rmse = result1D[0];
          metrics.mae = result1D[1];
          metrics.mape = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);
          __unpin(result3DPtr);
        } else {
          // Unpack ROC curves
          let result3D = __getArray(this.ebm.getMetricsOnSelectedSlice());
          let result3DPtr = __pin(result3D);

          // Unpack confusion matrix
          let result2D = __getArray(result3D[0]);
          let result2DPtr = __pin(result2D);

          let result1D = __getArray(result2D[0]);
          let result1DPtr = __pin(result1D);

          metrics.confusionMatrix = result1D;

          __unpin(result1DPtr);
          __unpin(result2DPtr);

          // Unpack summary statistics
          result2D = __getArray(result3D[1]);
          result2DPtr = __pin(result2D);

          result1D = __getArray(result2D[0]);
          result1DPtr = __pin(result1D);

          metrics.accuracy = result1D[0];
          metrics.rocAuc = result1D[1];
          metrics.balancedAccuracy = result1D[2];

          __unpin(result1DPtr);
          __unpin(result2DPtr);
          __unpin(result3DPtr);
        }

        return metrics;
      }

      /**
       * Set the current sliced data (a level of a categorical feature)
       * @param {int} featureID The index of the categorical feature
       * @param {int} featureLevel The integer encoding of the variable level
       * @returns {int} Number of test samples in this slice
       */
      setSliceData(featureID, featureLevel) {
        return this.ebm.setSliceData(featureID, featureLevel);
      }

    }

    let model = new EBM(_featureData, _sampleData, _editingFeature, _isClassification);
    return model;

  });
};

export { initEBM };
