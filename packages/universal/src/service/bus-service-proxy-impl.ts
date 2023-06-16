import { ServiceConstants } from './constants';
import { Deferred, getServiceCallChannel, getServiceEventChannel } from './utilities';
import { CheckTimeoutOptions } from '../utils';
import { ConnectionState } from '../utils/connection-state';

import type { IpcBusServiceEvent, ServiceCallback, ServiceEventEmitter, ServiceStatus } from './bus-service';
import type { IpcBusServiceProxy, ServiceProxyConnectOptions, ServiceProxyCreateOptions } from './bus-service-proxy';
import type { IpcBusClient, IpcBusEvent, IpcBusRequestResponse } from '../client/bus-client';
import type { IpcBusPeer } from '../contract/ipc-bus-peer';
import type { Logger } from '../log/logger';

interface CallWrapperEventEmitter extends ServiceEventEmitter {
    [key: string]: Function;
}

// Implementation of IPC service
export class IpcBusServiceProxyImpl implements IpcBusServiceProxy {
    private _isStarted: boolean = false;
    private _target: IpcBusPeer = undefined;
    private readonly _wrapper: CallWrapperEventEmitter;
    private readonly _connectCloseState = new ConnectionState();
    private readonly _pendingCalls = new Map<number, Deferred<unknown>>();

    constructor(
        private readonly _ipcBusClient: IpcBusClient,
        private readonly _serviceName: string,
        private readonly _emitter?: ServiceEventEmitter,
        private readonly _options?: ServiceProxyCreateOptions,
        private readonly _logger?: Logger
    ) {
        this._emitter?.setMaxListeners?.(0);
        this._options = CheckTimeoutOptions(this._options);
        this._wrapper = this._emitter ? Object.create(this._emitter) : {};
        this._onServiceReceived = this._onServiceReceived.bind(this);
    }

    get emitter(): ServiceEventEmitter {
        if (!this._emitter) {
            throw new Error(`Event Emitter is not available. Please pass 'emitter' to the constructor`);
        }
        return this._emitter;
    }

    get wrapper(): Object {
        return this._wrapper;
    }

    get isStarted(): boolean {
        return this._isStarted;
    }

    connect<R>(options?: ServiceProxyConnectOptions): Promise<R> {
        return this._connectCloseState.connect(() => {
            return new Promise<R>((resolve, reject) => {
                options = CheckTimeoutOptions(options);
                this._logger?.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is connecting`);

                // Register service start/stop/event events
                const eventChannel = getServiceEventChannel(this._serviceName);
                // Remove in case of unlikely re-entrance
                this._ipcBusClient.removeListener(eventChannel, this._onServiceReceived);
                this._ipcBusClient.addListener(eventChannel, this._onServiceReceived);

                this._callInternal(options.timeoutDelay, ServiceConstants.IPCBUS_SERVICE_CALL_GETSTATUS)
                    .then((res) => {
                        const serviceStatus = res.payload as ServiceStatus;
                        if (serviceStatus?.started) {
                            this._onServiceStart(res.event, serviceStatus);
                            resolve(this.getWrapper<R>());
                        }
                        this._logger?.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - not started`);
                        reject(new Error(`${this._serviceName} not started`));
                    })
                    // DeprecationWarning: Unhandled promise rejections are deprecated
                    .catch((err) => {
                        this._logger?.info(`[IpcBusServiceProxy] first status to '${this._serviceName}' - err: ${err}`);
                        reject(err);
                    });
            });
        });
    }

    close(): Promise<void> {
        return this._connectCloseState.close(() => {
            this._logger?.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is closed`);
            const eventChannel = getServiceEventChannel(this._serviceName);
            this._ipcBusClient.removeListener(eventChannel, this._onServiceReceived);
            this._onServiceStop();
            return Promise.resolve();
        });
    }

    getWrapper<R>(): R {
        return this._wrapper as R;
    }

    getStatus(): Promise<ServiceStatus> {
        return this._callInternal(
            this._options.timeoutDelay,
            ServiceConstants.IPCBUS_SERVICE_CALL_GETSTATUS
        ).then((res) => res.payload as ServiceStatus);
    }

    //#region event emitter implementation
    emit(event: string, ...args: any[]): boolean {
        return this._emitter.emit(event, ...args);
    }

    addListener(event: string, listener: ServiceCallback): ServiceEventEmitter {
        return this._emitter.addListener(event, listener);
    }

    removeListener(event: string, listener: ServiceCallback): ServiceEventEmitter {
        return this._emitter.removeListener(event, listener);
    }

    removeAllListeners(event?: string): ServiceEventEmitter {
        return this._emitter.removeAllListeners(event);
    }

    on(event: string, listener: ServiceCallback): ServiceEventEmitter {
        return this._emitter.on(event, listener);
    }

    once(event: string, listener: ServiceCallback): ServiceEventEmitter {
        return this._emitter.once(event, listener);
    }

    off(event: string, listener: ServiceCallback): ServiceEventEmitter {
        return this._emitter.off(event, listener);
    }

    eventNames(): (string | symbol)[] {
        return this._emitter.eventNames();
    }

    listenerCount(eventName: string): number {
        return this._emitter.listenerCount(eventName);
    }

    listeners(eventName: string): Function[] {
        return this._emitter.listeners(eventName);
    }
    //#endregion

    requestApply<R>(name: string, args?: unknown[]): Promise<R> {
        const deferred = this._requestApply(-1, name, args);
        if (this._isStarted) {
            deferred.execute();
        } else {
            this._logger?.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
        return deferred.promise.then((res) => <R>res.payload);
    }

    requestCall<R>(name: string, ...args: any[]): Promise<R> {
        return this.requestApply(name, args);
    }

    apply<R>(name: string, args?: unknown[]): Promise<R> {
        return this.requestApply(name, args);
    }

    call<R>(name: string, ...args: any[]): Promise<R> {
        return this.requestApply(name, args);
    }

    sendApply(name: string, args?: unknown[]): void {
        if (this._isStarted) {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.sendTo(this._target, getServiceCallChannel(this._serviceName), callMsg);
        } else {
            this._sendApply(name, args);
            this._logger?.info(`[IpcBusServiceProxy] call delayed '${name}' from service '${this._serviceName}'`);
        }
    }

    sendCall(name: string, ...args: any[]): void {
        return this.sendApply(name, args);
    }

    private _requestApply(timeout: number, name: string, args?: unknown[]): Deferred<IpcBusRequestResponse> {
        const deferred = new Deferred<IpcBusRequestResponse>((resolve, reject) => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient
                .requestTo(this._target, getServiceCallChannel(this._serviceName), timeout, callMsg)
                .then((res: IpcBusRequestResponse) => {
                    this._logger?.info(
                        `[IpcBusServiceProxy] resolve call to '${name}' from service '${
                            this._serviceName
                        }' - res: ${JSON.stringify(res)}`
                    );
                    this._pendingCalls.delete(deferred.id);
                    resolve(res);
                })
                .catch((res: IpcBusRequestResponse) => {
                    this._logger?.info(
                        `[IpcBusServiceProxy] reject call to '${name}' from service '${
                            this._serviceName
                        }' - res: ${JSON.stringify(res)}`
                    );
                    this._pendingCalls.delete(deferred.id);
                    reject(res.err);
                });
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }

    private _callInternal(timeout: number, name: string, ...args: any[]): Promise<IpcBusRequestResponse> {
        const deferred = this._requestApply(timeout, name, args);
        deferred.execute();
        return deferred.promise;
    }

    private _sendApply(name: string, args?: unknown[]): Deferred<void> {
        const deferred = new Deferred<void>(() => {
            const callMsg = { handlerName: name, args: args };
            this._ipcBusClient.sendTo(this._target, getServiceCallChannel(this._serviceName), callMsg);
            this._pendingCalls.delete(deferred.id);
        }, false);
        this._pendingCalls.set(deferred.id, deferred);
        return deferred;
    }

    private _updateWrapper(serviceStatus: ServiceStatus): void {
        for (let i = 0, l = serviceStatus.callHandlers.length; i < l; ++i) {
            const handlerName = serviceStatus.callHandlers[i];
            const requestProc = (...args: any[]) => {
                return this.requestApply<Object>(handlerName, args);
            };
            const sendProc = (...args: any[]) => {
                return this.sendApply(handlerName, args);
            };
            this._wrapper[handlerName] = requestProc;
            this._wrapper[`request_${handlerName}`] = requestProc;
            this._wrapper[`send_${handlerName}`] = sendProc;
            this._logger?.info(
                `[IpcBusServiceProxy] Service '${this._serviceName}' added '${handlerName}' to its wrapper`
            );
        }
    }

    private _onServiceReceived(event: IpcBusEvent, msg: IpcBusServiceEvent): void {
        try {
            if (msg.eventName === ServiceConstants.IPCBUS_SERVICE_WRAPPER_EVENT) {
                this._logger?.info(
                    `[IpcBusServiceProxy] Wrapper '${this._serviceName}' receive event '${msg.args[0]}'`
                );
                this.emitter.emit(msg.args[0] as string, ...(msg.args[1] as unknown[]));
                return;
            }
            this._logger?.info(`[IpcBusServiceProxy] Service '${this._serviceName}' receive event '${msg.eventName}'`);
            switch (msg.eventName) {
                case ServiceConstants.IPCBUS_SERVICE_EVENT_START:
                    this._onServiceStart(event, msg.args[0] as ServiceStatus);
                    break;
                case ServiceConstants.IPCBUS_SERVICE_EVENT_STOP:
                    this._onServiceStop();
                    break;
                default:
                    this.emitter.emit(msg.eventName, ...msg.args);
                    break;
            }
        } catch (error) {
            this._logger?.error(`[IpcBusServiceProxy] Error on service event received: ${error}`);
            throw error;
        }
    }

    private _onServiceStart(event: IpcBusEvent, serviceStatus: ServiceStatus) {
        if (this._isStarted === false) {
            this._isStarted = true;
            this._logger?.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STARTED`);
            if (serviceStatus.direct) {
                this._target = event.sender;
            }
            this._updateWrapper(serviceStatus);
            if (this._emitter) {
                this._emitter.emit(ServiceConstants.IPCBUS_SERVICE_EVENT_START, serviceStatus);
            }

            this._pendingCalls.forEach((deferred) => {
                deferred.execute();
            });
            this._pendingCalls.clear();
        }
    }

    private _onServiceStop() {
        if (this._isStarted) {
            this._isStarted = false;
            this._logger?.info(`[IpcBusServiceProxy] Service '${this._serviceName}' is STOPPED`);

            if (this._emitter) {
                this._emitter.emit(ServiceConstants.IPCBUS_SERVICE_EVENT_STOP);
            }

            this._pendingCalls.forEach((deferred) => {
                deferred.reject(`Service '${this._serviceName}' stopped`);
            });
            this._pendingCalls.clear();
            this._target = undefined;
        }
    }
}
