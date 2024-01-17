export class ClonerMap {
    constructor(public readonly schema: any) {}
}

export class ClonerSet {
    constructor(public readonly schema: any) {}
}

/** usable eg for arguments */
export class ClonerArrayLike {
    constructor(public readonly schema: any) {}
}

export class ClonerCustomFn {
    constructor(public readonly fn: (x: any) => any) {}
}

type ClonerOpts = {
    detectCycles?: boolean;
};

function createClonerCodeCtx() {
    return {
        cycles: new Map<any, () => string>(),
        customObjs: new Map<any, string>(),
    };
}

export function createClonerCode(
    schema: any,
    inputName: string,
    opts: ClonerOpts,
    ctx = createClonerCodeCtx()
): string {
    if (ctx.cycles.has(schema)) {
        return ctx.cycles.get(schema)!() + `(${inputName})`;
    }

    if (
        schema === Number ||
        schema === String ||
        schema === Boolean ||
        schema === Function ||
        schema === Symbol
    ) {
        return inputName;
    } else if (schema === BigInt) {
        return `new BigInt(${inputName})`;
    } else if (schema === Date) {
        return `new Date(${inputName})`;
    } else if (schema === null) {
        return `null`;
    } else if (schema === undefined) {
        return `undefined`;
    } else if (
        schema === Buffer ||
        schema === Int8Array ||
        schema === Uint8Array ||
        schema === Uint8ClampedArray ||
        schema === Int16Array ||
        schema === Uint16Array ||
        schema === Int32Array ||
        schema === Uint32Array ||
        schema === Float32Array ||
        schema === Float64Array ||
        schema === BigInt64Array ||
        schema === BigUint64Array ||
        schema === ArrayBuffer
    ) {
        return `${inputName}.subarray()`;
    } else if (
        // naive map
        schema === Map
    ) {
        return `(function (inputMap) {
            const m = new Map();
            inputMap.forEach(function (v, k) {
                m.set(k, JSON.parse(JSON.stringify(v)));
            });
            return m;
        })(${inputName})`;
    } else if (
        // naive set
        schema === Set
    ) {
        return `(function (inputSet) {
            const m = new Set();
            inputSet.forEach(function (v) {
                m.add(JSON.parse(JSON.stringify(v)));
            });
            return m;
        })(${inputName})`;
    } else if (schema instanceof ClonerMap) {
        return `(function (inputMap) {
            const m = new Map();
            inputMap.forEach(function (v, k) {
                m.set(k, ${createClonerCode(schema.schema, "v", opts, ctx)});
            });
            return m;
        })(${inputName})`;
    } else if (schema instanceof ClonerSet) {
        return `(function (inputSet) {
            const m = new Set();
            inputSet.forEach(function (v) {
                m.add(${createClonerCode(schema.schema, "v", opts, ctx)});
            });
            return m;
        })(${inputName})`;
    } else if (schema instanceof ClonerArrayLike) {
        const code = `Array.prototype.map.call(${inputName}, function(x) {
            return ${createClonerCode(schema.schema, "x", opts, ctx)};
        })`;

        if (opts.detectCycles) {
            return `cycleObjs.has(${inputName}) ? cycleObjs.get(${inputName}) : ${code}`;
        }

        return code;
    } else if (Array.isArray(schema)) {
        if (schema.length === 0) {
            return "[]";
        }

        if (schema.length > 1) {
            throw new Error("unsupported array schema with alternative items");
        }

        const code = `${inputName}.map(function(x) {
            return ${createClonerCode(schema[0], "x", opts, ctx)};
        })`;

        if (opts.detectCycles) {
            return `cycleObjs.has(${inputName}) ? cycleObjs.get(${inputName}) : ${code}`;
        }

        return code;
    } else if (schema instanceof ClonerCustomFn) {
        if (!ctx.customObjs.has(schema.fn)) {
            const id = `customObj_${ctx.customObjs.size}`;
            ctx.customObjs.set(schema.fn, id);
        }
        return `${ctx.customObjs.get(schema)}(${inputName})`;
    } else if (typeof schema === "object") {
        let code = "{";

        let cycleGetter = "";
        let cycleFound = false;
        const cycleResolver = () => {
            if (!opts.detectCycles)
                throw new Error("opts.detectCycles not set");
            if (cycleFound) return cycleGetter;
            const cycleId = Math.floor(Math.random() * 99999);
            code = `(function cycle${cycleId}(input) { if (cycleObjs.has(input)) return cycleObjs.get(input); const obj = {}; cycleObjs.set(input, obj); Object.assign(obj, ${code}`;
            cycleGetter = `cycle${cycleId}`;
            cycleFound = true;
            return cycleGetter;
        };
        ctx.cycles.set(schema, cycleResolver);

        for (const field in schema) {
            code += field + ":";

            const clonerCode = createClonerCode(
                schema[field],
                inputName + "." + field,
                opts,
                ctx
            );
            code += `${clonerCode},`;
        }
        code += "}";

        if (cycleFound) {
            // TODO: may be bug when nesting circular
            code = code.replaceAll(inputName, "input");
            code += `); return obj; })(${inputName})`;
        }

        if (opts.detectCycles) {
            return `cycleObjs.has(${inputName}) ? cycleObjs.get(${inputName}) : ${code}`;
        }

        return code;
    }

    throw new Error("unsupported schema root");
}

export function createCloner<T = any>(
    schema: any,
    opts: ClonerOpts = {}
): (x: T) => T {
    const ctx = createClonerCodeCtx();
    const code = createClonerCode(schema, "input", opts, ctx);
    const clonerFnCode = `(function (input) {
        ${opts.detectCycles ? `const cycleObjs = new Map();` : ""}
        return ${code};
    })`;

    let clonerFn;

    // map custom objs inside
    if (ctx.customObjs.size !== 0) {
        clonerFn = eval(`(function (customObjs) {
            ${Array.from(ctx.customObjs.keys())
                .map((key) => `const ${key} = customObjs.get("${key}");`)
                .join("\n")}

            return ${clonerFnCode};
        })`)(ctx.customObjs);
    } else {
        clonerFn = eval(clonerFnCode);
    }

    return clonerFn;
}

type CreateCloneSchemaFromOpts = {
    cloneProto?: boolean;
};

export function createCloneSchemaFrom(
    x: any,
    opts: CreateCloneSchemaFromOpts = {},
    ctx = { cycles: new Map<any, any>() }
): any {
    if (ctx.cycles.has(x)) return ctx.cycles.get(x);

    if (x === undefined || x === null) return x;

    if (typeof x === "number") return Number;
    if (typeof x === "string") return String;
    if (typeof x === "boolean") return Boolean;
    if (typeof x === "function") return Function;
    if (typeof x === "symbol") return Symbol;
    if (typeof x === "bigint") return BigInt;

    if (x instanceof Date) return Date;

    if (x instanceof Int8Array) return Int8Array;
    if (x instanceof Uint8Array) return Uint8Array;
    if (x instanceof Uint8ClampedArray) return Uint8ClampedArray;
    if (x instanceof Int16Array) return Int16Array;
    if (x instanceof Uint16Array) return Uint16Array;
    if (x instanceof Int32Array) return Int32Array;
    if (x instanceof Uint32Array) return Uint32Array;
    if (x instanceof Float32Array) return Float32Array;
    if (x instanceof Float64Array) return Float64Array;
    if (x instanceof BigInt64Array) return BigInt64Array;
    if (x instanceof BigUint64Array) return BigUint64Array;
    if (x instanceof Buffer) return Buffer;
    if (x instanceof ArrayBuffer) return ArrayBuffer;

    // TODO: implement non naive
    if (x instanceof Map) return Map;
    if (x instanceof Set) return Set;

    if (!Array.isArray(x) && x[Symbol.iterator] !== undefined) {
        console.warn("partial support for iterators");
        if (x.length === 0) return [];
        if (x.length > 1) console.warn("unsupported array with variants");
        return new ClonerArrayLike(createCloneSchemaFrom(x[0], opts, ctx));
    }

    if (Array.isArray(x)) {
        const obj = [] as any;
        ctx.cycles.set(x, obj);
        if (x.length === 0) return obj;
        if (x.length > 1) console.warn("unsupported array with variants");
        obj.push(createCloneSchemaFrom(x[0], opts, ctx));
        return obj;
    }

    if (typeof x === "object") {
        const obj = {} as any;
        ctx.cycles.set(x, obj);
        for (const field in x) {
            if (!opts.cloneProto && !Object.hasOwn(x, field)) continue;
            obj[field] = createCloneSchemaFrom(x[field], opts, ctx);
        }
        return obj;
    }

    throw new Error("unsupported type");
}
