import { ServiceConstants } from './constants';

/** @internal */
export class Deferred<T> {
    private static _globalCounter: number = 0;

    public promise: Promise<T>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public resolve: (t: any) => void;
    public reject: (err: string) => void;
    public id: number;

    private _executor: Function;

    constructor(
        executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void) => void,
        immediately: boolean = true
    ) {
        this.id = ++Deferred._globalCounter;
        this.promise = new Promise<T>((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
            if (immediately) {
                if (executor) {
                    executor(resolve, reject);
                }
            } else {
                this._executor = executor;
            }
        });
    }

    public execute() {
        if (this._executor) {
            this._executor(this.resolve, this.reject);
        }
    }

    public then(onThen: (value: T) => T | PromiseLike<T>): Promise<T> {
        return this.promise.then(onThen);
    }

    public catch(onCatch: (reason: unknown) => T | PromiseLike<T>): Promise<T> {
        return this.promise.catch(onCatch);
    }
}

// Helper to get a valid service channel namespace
export function getServiceNamespace(serviceName: string): string {
    return `${ServiceConstants.IPCBUS_CHANNEL}/ipc-service/${serviceName}`;
}

// Helper to get the call channel related to given service
export function getServiceCallChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/call';
}

// Helper to get the event channel related to given service
export function getServiceEventChannel(serviceName: string): string {
    return getServiceNamespace(serviceName) + '/event';
}

function hasMethod(obj: object, name: string): PropertyDescriptor | undefined {
    if (name === 'constructor') {
        return undefined;
    }
    // Hide private methods, supposed to be pre-fixed by one or several underscores
    if (name[0] === '_') {
        return undefined;
    }
    const desc = Object.getOwnPropertyDescriptor(obj, name);
    if (Boolean(desc) && typeof desc.value === 'function') {
        return desc;
    }
    return undefined;
}

export function getInstanceMethodNames<Proto>(obj: object, emitterProto?: Proto): Map<string, PropertyDescriptor> {
    const methodNames = new Map<string, PropertyDescriptor>();

    Object.getOwnPropertyNames(obj).forEach((name) => {
        const desc = hasMethod(obj, name);
        if (desc) {
            methodNames.set(name, desc);
        }
    });

    let proto = Object.getPrototypeOf(obj);
    while (proto) {
        if (emitterProto && proto === emitterProto) {
            // Remove EventEmitter overriden methods
            Object.keys(emitterProto).forEach((prop) => {
                if (prop[0] !== '_') {
                    methodNames.delete(prop);
                }
            });
            methodNames.delete('off');
            break;
        } else if (proto === Object.prototype) {
            break;
        }
        Object.getOwnPropertyNames(proto).forEach((name) => {
            const desc = hasMethod(proto, name);
            if (desc && !methodNames.has(name)) {
                methodNames.set(name, desc);
            }
        });
        proto = Object.getPrototypeOf(proto);
    }
    return methodNames;
}
