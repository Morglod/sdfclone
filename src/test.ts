import { deepEquals } from "bun";
import { createCloner, createCloneSchemaFrom } from ".";

function assert(a: any, b: any) {
    if (!deepEquals(a, b, true)) {
        throw new Error("assertion failed");
    }
}

{
    const numberCloner = createCloner<number>(Number);
    assert(numberCloner(10), 10);
}

{
    const numberCloner = createCloner(createCloneSchemaFrom(10));
    assert(numberCloner(10), 10);
}

{
    const dateCloner = createCloner<Date>(
        createCloneSchemaFrom(new Date(10000))
    );
    assert(dateCloner(new Date(10000)), new Date(10000));
}
