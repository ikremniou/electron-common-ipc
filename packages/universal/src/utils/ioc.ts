// https://derickbailey.com/2016/03/09/creating-a-true-singleton-in-node-js-with-es6-symbols/
export interface BusContainer {
    getSingleton<T>(symbolName: string | symbol): T | undefined;
    registerSingleton<T>(symbolName: string | symbol, singleton: T): void;
}

const PrefixSymbol = 'ec-ipc:';
export class GlobalContainer implements BusContainer {
    static reset(): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalAsAny = globalThis as any;
        globalAsAny.ecIpcContainer = undefined;
    }
    
    static container<T>(): Record<symbol, T> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalAsAny = globalThis as any;
        if (!globalAsAny.ecIpcContainer) {
            globalAsAny.ecIpcContainer = {};
        }

        return globalAsAny.ecIpcContainer;
    }
    
    getSingleton<T>(symbolName: string | symbol): T {
        const symbolRef = typeof symbolName === 'symbol' ? symbolName : Symbol.for(`${PrefixSymbol}${symbolName}`);
        return GlobalContainer.container<T>()[symbolRef];
    }

    registerSingleton<T>(symbolName: string | symbol, singleton: T): void {
        const symbolRef = typeof symbolName === 'symbol' ? symbolName : Symbol.for(`${PrefixSymbol}${symbolName}`);
        GlobalContainer.container<T>()[symbolRef] = singleton;
    }
}
