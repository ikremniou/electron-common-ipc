const chai = require('chai');
const assert = chai.assert;
const nanoid = require('nanoid');

describe('map travel', () => {
    const size = 10000;
    const map = new Map();
    before(() => {
        for (let i = 0; i < size; ++i) {
            map.set(i.toString(), i.toString());
        }
    });

    it(`forEach`, () => {
        console.time('forEach');
        map.forEach((value, key) => {
            const j = Number(value);
            j;
            key;
        });
        console.timeEnd('forEach');
    });

    it(`for of`, () => {
        console.time('for of');
        for (let [key, value] of map) {
            const j = Number(value);
            j;
            key;
        }
        console.timeEnd('for of');
    });

    it(`for of #2`, () => {
        console.time('for of #2');
        for (let entry of map) {
            const j = Number(entry[1]);
            j;
            entry[0];
        }
        console.timeEnd('for of #2');
    });
});

describe('map access object vs number', () => {
    const mapNumber = new Map();
    const mapObject = new Map();
    for (let i = 0; i < 100000; ++i) {
        mapNumber.set(nanoid.nanoid(), 1);
        mapObject.set(nanoid.nanoid(), { refCount: 1 });
    }

    it(`addRef - object`, () => {
        mapObject.set('test', { refCount: 1 })
        for (let i = 0; i < 100000000; ++i) {
            const test = mapObject.get('test');
            test.refCount += 1;
        }
    });

    it(`addRef - number`, () => {
        mapNumber.set('test', 1)
        for (let i = 0; i < 100000000; ++i) {
            let test = mapNumber.get('test');
            test += 1;
            mapNumber.set('test', test);
        }
    });
});

