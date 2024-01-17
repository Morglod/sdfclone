'use strict'

const { test } = require('tap');
const tap = require('tap');

const { createCloner, createClonerCode, createCloneSchemaFrom } = require('../lib/index.js');

function clone(x) {
    const schema = createCloneSchemaFrom(x);
    try {
        const cloner = createCloner(schema);
        return cloner(x);
    } catch (err) {
        const code = createClonerCode(schema, "input", {});
        console.error('-----');
        console.error('generate failed for');
        console.error(x);
        console.error('code:');
        console.error(code);
        console.error('-----');
        console.error(err);
        throw err;
    }
}

function cloneCircles(x) {
    const schema = createCloneSchemaFrom(x);
    try {
        const cloner = createCloner(schema, { detectCycles: true });
        return cloner(x);
    } catch (err) {
        const code = createClonerCode(schema, "input", { detectCycles: true });
        console.error('-----');
        console.error('generate failed for');
        console.error(x);
        console.error('code:');
        console.error(code);
        console.error('-----');
        console.error(err);
        throw err;
    }
}
const rnd = (max) => Math.round(Math.random() * max)

types(clone, 'default')

test('default – does not copy proto properties', async ({ equal }) => {
    equal(clone(Object.create({ a: 1 })).a, undefined, 'value not copied')
})

test('circles option - circular object', async ({ same, equal, not }) => {
    const o = { nest: { a: 1, b: 2 } }
    o.circular = o
    same(cloneCircles(o), o, 'same values')
    not(cloneCircles(o), o, 'different objects')
    not(cloneCircles(o).nest, o.nest, 'different nested objects')
    const c = cloneCircles(o)
    equal(c.circular, c, 'circular references point to copied parent')
    not(c.circular, o, 'circular references do not point to original parent')
})
test('circles option – deep circular object', async ({ same, equal, not }) => {
    const o = { nest: { a: 1, b: 2 } }
    o.nest.circular = o
    same(cloneCircles(o), o, 'same values')
    not(cloneCircles(o), o, 'different objects')
    not(cloneCircles(o).nest, o.nest, 'different nested objects')
    const c = cloneCircles(o)
    equal(c.nest.circular, c, 'circular references point to copied parent')
    not(
        c.nest.circular,
        o,
        'circular references do not point to original parent'
    )
})

function types(clone, label) {
    test(label + ' – number', async ({ equal }) => {
        equal(clone(42), 42, 'same value')
    })
    test(label + ' – string', async ({ equal }) => {
        equal(clone('str'), 'str', 'same value')
    })
    test(label + ' – boolean', async ({ equal }) => {
        equal(clone(true), true, 'same value')
    })
    test(label + ' – function', async ({ equal }) => {
        const fn = () => { }
        equal(clone(fn), fn, 'same function')
    })
    test(label + ' – async function', async ({ equal }) => {
        const fn = async () => { }
        equal(clone(fn), fn, 'same function')
    })
    test(label + ' – generator function', async ({ equal }) => {
        const fn = function* () { }
        equal(clone(fn), fn, 'same function')
    })
    test(label + ' – date', async ({ equal, not }) => {
        const date = new Date()
        equal(+clone(date), +date, 'same value')
        not(clone(date), date, 'different object')
    })
    test(label + ' – null', async ({ equal }) => {
        equal(clone(null), null, 'same value')
    })
    test(label + ' – shallow object', async ({ same, not }) => {
        const o = { a: 1, b: 2 }
        same(clone(o), o, 'same values')
        not(clone(o), o, 'different object')
    })
    test(label + ' – shallow array', async ({ same, not }) => {
        const o = [1, 2]
        same(clone(o), o, 'same values')
        not(clone(o), o, 'different arrays')
    })
    test(label + ' – deep object', async ({ same, not }) => {
        const o = { nest: { a: 1, b: 2 } }
        same(clone(o), o, 'same values')
        not(clone(o), o, 'different objects')
        not(clone(o).nest, o.nest, 'different nested objects')
    })
    // TODO:
    // test(label + ' – deep array', async ({ same, not }) => {
    //     const o = [{ a: 1, b: 2 }, [3]]
    //     same(clone(o), o, 'same values')
    //     not(clone(o), o, 'different arrays')
    //     not(clone(o)[0], o[0], 'different array elements')
    //     not(clone(o)[1], o[1], 'different array elements')
    // })
    test(label + ' – nested number', async ({ equal }) => {
        equal(clone({ a: 1 }).a, 1, 'same value')
    })
    test(label + ' – nested string', async ({ equal }) => {
        equal(clone({ s: 'str' }).s, 'str', 'same value')
    })
    test(label + ' – nested boolean', async ({ equal }) => {
        equal(clone({ b: true }).b, true, 'same value')
    })
    test(label + ' – nested function', async ({ equal }) => {
        const fn = () => { }
        equal(clone({ fn }).fn, fn, 'same function')
    })
    test(label + ' – nested async function', async ({ equal }) => {
        const fn = async () => { }
        equal(clone({ fn }).fn, fn, 'same function')
    })
    test(label + ' – nested generator function', async ({ equal }) => {
        const fn = function* () { }
        equal(clone({ fn }).fn, fn, 'same function')
    })
    test(label + ' – nested date', async ({ equal, not }) => {
        const date = new Date()
        equal(+clone({ d: date }).d, +date, 'same value')
        not(clone({ d: date }).d, date, 'different object')
    })
    test(label + ' – nested date in array', async ({ equal, not }) => {
        const date = new Date()
        equal(+clone({ d: [date] }).d[0], +date, 'same value')
        not(clone({ d: [date] }).d[0], date, 'different object')
        equal(+cloneCircles({ d: [date] }).d[0], +date, 'same value')
        not(cloneCircles({ d: [date] }).d, date, 'different object')
    })
    test(label + ' – nested null', async ({ equal }) => {
        equal(clone({ n: null }).n, null, 'same value')
    })
    test(label + ' – arguments', async ({ not, same }) => {
        function fn(...args) {
            same(clone(arguments), args, 'same values')
            not(clone(arguments), arguments, 'different object')
        }
        fn(1, 2, 3)
    })
    test(`${label} copies buffers from object correctly`, async ({ ok, equal, not }) => {
        const input = Date.now().toString(36)
        const inputBuffer = Buffer.from(input)
        const clonedBuffer = clone({ a: inputBuffer }).a
        tap.ok(Buffer.isBuffer(clonedBuffer), 'cloned value equal buffer')
        not(clonedBuffer, inputBuffer, 'cloned buffer equal not same as input buffer')
        equal(clonedBuffer.toString(), input, 'cloned buffer content equal correct')
    })
    test(`${label} copies buffers from arrays correctly`, async ({ ok, equal, not }) => {
        const input = Date.now().toString(36)
        const inputBuffer = Buffer.from(input)
        const [clonedBuffer] = clone([inputBuffer])
        tap.ok(Buffer.isBuffer(clonedBuffer), 'cloned value equal buffer')
        not(clonedBuffer, inputBuffer, 'cloned buffer equal not same as input buffer')
        equal(clonedBuffer.toString(), input, 'cloned buffer content equal correct')
    })
    test(`${label} copies TypedArrays from object correctly`, async ({ ok, equal, not }) => {
        const [input1, input2] = [rnd(10), rnd(10)]
        var buffer = new ArrayBuffer(8)
        const int32View = new Int32Array(buffer)
        int32View[0] = input1
        int32View[1] = input2
        const cloned = clone({ a: int32View }).a
        tap.ok(cloned instanceof Int32Array, 'cloned value equal instance of class')
        not(cloned, int32View, 'cloned value equal not same as input value')
        equal(cloned[0], input1, 'cloned value content equal correct')
        equal(cloned[1], input2, 'cloned value content equal correct')
    })
    test(`${label} copies TypedArrays from array correctly`, async ({ ok, equal, not }) => {
        const [input1, input2] = [rnd(10), rnd(10)]
        var buffer = new ArrayBuffer(16)
        const int32View = new Int32Array(buffer)
        int32View[0] = input1
        int32View[1] = input2
        const [cloned] = clone([int32View])
        tap.ok(cloned instanceof Int32Array, 'cloned value equal instance of class')
        not(cloned, int32View, 'cloned value equal not same as input value')
        equal(cloned[0], input1, 'cloned value content equal correct')
        equal(cloned[1], input2, 'cloned value content equal correct')
    })
    test(`${label} copies complex TypedArrays`, async ({ ok, same, equal, not }) => {
        const [input1, input2, input3] = [rnd(10), rnd(10), rnd(10)]
        var buffer = new ArrayBuffer(4)
        const view1 = new Int8Array(buffer, 0, 2)
        const view2 = new Int8Array(buffer, 2, 2)
        const view3 = new Int8Array(buffer)
        view1[0] = input1
        view2[0] = input2
        view3[3] = input3
        const cloned = clone({ view1, view2, view3 })
        ok(cloned.view1 instanceof Int8Array, 'cloned value equal instance of class')
        ok(cloned.view2 instanceof Int8Array, 'cloned value equal instance of class')
        ok(cloned.view3 instanceof Int8Array, 'cloned value equal instance of class')
        not(cloned.view1, view1, 'cloned value equal not same as input value')
        not(cloned.view2, view2, 'cloned value equal not same as input value')
        not(cloned.view3, view3, 'cloned value equal not same as input value')
        same(Array.from(cloned.view1), [input1, 0], 'cloned value content equal correct')
        same(Array.from(cloned.view2), [input2, input3], 'cloned value content equal correct')
        same(Array.from(cloned.view3), [input1, 0, input2, input3], 'cloned value content equal correct')
    })
    test(`${label} - maps`, async ({ same, not }) => {
        const map = new Map([['a', 1]])
        same(Array.from(clone(map)), [['a', 1]], 'same value')
        not(clone(map), map, 'different object')
    })
    test(`${label} - sets`, async ({ same, not }) => {
        const set = new Set([1])
        same(Array.from(clone(set)), [1])
        not(clone(set), set, 'different object')
    })
    test(`${label} - nested maps`, async ({ same, not }) => {
        const data = { m: new Map([['a', 1]]) }
        same(Array.from(clone(data).m), [['a', 1]], 'same value')
        not(clone(data).m, data.m, 'different object')
    })
    test(`${label} - nested sets`, async ({ same, not }) => {
        const data = { s: new Set([1]) }
        same(Array.from(clone(data).s), [1], 'same value')
        not(clone(data).s, data.s, 'different object')
    })
}