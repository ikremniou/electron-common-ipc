const chai = require('chai');
const assert = chai.assert;
const shortid = require('shortid');

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
});

describe('map access object vs number', () => {
    const mapNumber = new Map();
    const mapObject = new Map();
    for (let i = 0; i < 100000; ++i) {
        mapNumber.set(shortid.generate(), 1);
        mapObject.set(shortid.generate(), { refCount: 1 });
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

