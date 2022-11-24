// https://derickbailey.com/2016/03/09/creating-a-true-singleton-in-node-js-with-es6-symbols/
export interface BusContainer {
    getSingleton<T>(symbolName: string): T | undefined;
    registerSingleton<T>(symbolName: string, singleton: T): void;
}

const PrefixSymbol = 'ec-ipc:';
export class GlobalContainer implements BusContainer {
    getSingleton<T>(symbolName: string): T {
        const symbolRef = Symbol.for(`${PrefixSymbol}${symbolName}`);
        return (globalThis as unknown as Record<typeof symbolRef, T>)[symbolRef];
    }

    registerSingleton<T>(symbolName: string, singleton: T): void {
        const symbolRef = Symbol.for(`${PrefixSymbol}${symbolName}`);
        (globalThis as unknown as Record<typeof symbolRef, T>)[symbolRef] = singleton;
    }
}
