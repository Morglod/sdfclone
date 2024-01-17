"use strict";

const { createCloner, createCloneSchemaFrom } = require("./index");

const benchmark = require("benchmark");

const rfdcClone = require("rfdc")();

const lodashCloneDeep = require("lodash").cloneDeep;

const fastestJsonCopy = require("fastest-json-copy").copy;

function createObject() {
    return {
        x: Math.random(),
        y: {
            z: Math.random().toString(),
            c: {
                bb: Math.random(),
            },
            gg: [
                {
                    ff: 22,
                    hh: Math.random(),
                },
            ],
        },
    };
}

type ObjT = ReturnType<typeof createObject>;

function naiveManualClone(from: ObjT): ObjT {
    const obj2 = {
        ...from,
        y: {
            ...from.y,
            c: {
                ...from.y.c,
            },
            gg: from.y.gg.map((x: any) => ({ ...x })),
        },
    };
    return obj2;
}

function optimalManualClone(from: ObjT): ObjT {
    const obj2 = {
        x: from.x,
        y: {
            z: from.y.z,
            c: {
                bb: from.y.c.bb,
            },
            gg: from.y.gg.map((x) => ({
                ff: x.ff,
                hh: x.hh,
            })),
        },
    };
    return obj2;
}

let deopt = 0;

const clonerSchema = {
    x: Number,
    y: {
        z: String,
        c: {
            bb: Number,
        },
        gg: [{ ff: Number, hh: Number }],
    },
};

const cloner = createCloner(clonerSchema, {
    detectCycles: false,
});

const clonerCycles = createCloner(clonerSchema, {
    detectCycles: true,
});

new benchmark.Suite()
    .add("naive", function () {
        const o = createObject();
        const r = naiveManualClone(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("optimal", function () {
        const o = createObject();
        const r = optimalManualClone(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("JSON.parse", function () {
        const o = createObject();
        const r = JSON.parse(JSON.stringify(o));
        deopt += r.x + r.y.c.bb;
    })

    .add("fast deep cloner", function () {
        const o = createObject();
        const r = cloner(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("fast deep cloner detect cycles", function () {
        const o = createObject();
        const r = clonerCycles(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("fast deep cloner with create", function () {
        const o = createObject();
        const r = createCloner(clonerSchema)(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("fast deep cloner with schema get and create", function () {
        const o = createObject();
        const r = createCloner(createCloneSchemaFrom(o))(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("structured clone", function () {
        const o = createObject();
        const r = structuredClone(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("rfdc", function () {
        const o = createObject();
        const r = rfdcClone(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("lodash cloneDeep", function () {
        const o = createObject();
        const r = lodashCloneDeep(o);
        deopt += r.x + r.y.c.bb;
    })

    .add("fastestJsonCopy", function () {
        const o = createObject();
        const r = fastestJsonCopy(o);
        deopt += r.x + r.y.c.bb;
    })

    .on("cycle", function cycle(e: any) {
        console.log(e.target.toString());
    })
    .on("complete", function completed(this: any) {
        console.log("Fastest is %s", this.filter("fastest").map("name"));
    })
    .run({ async: true });
