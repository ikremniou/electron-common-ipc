export class ConnectionState {
    protected _waitForConnected?: Promise<unknown>;
    protected _waitForClosed: Promise<void>;
    protected _connected: boolean;

    constructor() {
        this.shutdown();
    }

    get connected(): boolean {
        return this._connected;
    }

    connect<T>(cb: () => Promise<T>): Promise<T> {
        if (!this._waitForConnected) {
            this._waitForConnected = this._waitForClosed
            .then(() => {
                return cb();
            })
            .then((t) => {
                this._connected = true;
                return t;
            })
            .catch((err) => {
                this.shutdown();
                throw err;
            });
        }
        return this._waitForConnected as Promise<T>;
    }

    close(cb: () => Promise<void>): Promise<void> {
        if (this._waitForConnected) {
            const waitForConnected = this._waitForConnected;
            this._waitForConnected = undefined;
            this._waitForClosed = waitForConnected
            .then(() => {
                return cb();
            })
            .finally(() => {
                this.shutdown();
            });
        }
        return this._waitForClosed;
    }

    shutdown() {
        this._waitForConnected = undefined;
        this._waitForClosed = Promise.resolve();
        this._connected = false;
    }
}
