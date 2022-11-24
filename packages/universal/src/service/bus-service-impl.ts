import { ServiceConstants } from './constants';
import { getInstanceMethodNames, getServiceCallChannel, getServiceEventChannel } from './utilities';

import type { IpcBusClient, IpcBusEvent } from '../client/bus-client';
import type { EventEmitterLike } from '../client/event-emitter-like';
import type { Logger } from '../log/logger';
import type { IpcBusService, IpcBusServiceCall, IpcBusServiceEvent, ServiceStatus } from './bus-service';

interface Prototype {
    prototype: unknown;
}

// Implementation of IPC service
export class IpcBusServiceImpl implements IpcBusService {
    private readonly _callHandlers: Map<string, Function>;
    // private _eventHandlers: Map<string, Set<string>>;
    private _prevImplEmit?: typeof this._emitter['emit'] = undefined;

    constructor(
        private readonly _ipcBusClient: IpcBusClient,
        private readonly _serviceName: string,
        private readonly _emitter: EventEmitterLike<Function>,
        private readonly _exposedInstance: Partial<typeof _emitter>,
        private readonly _logger?: Logger
    ) {
        this._callHandlers = new Map<string, Function>();
        // this._eventHandlers = new Map<string, Set<string>>();

        // Callback
        this._onCallReceived = this._onCallReceived.bind(this);

        //  Register internal call handlers
        this.registerCallHandler(ServiceConstants.IPCBUS_SERVICE_CALL_GETSTATUS, () => {
            return this._getServiceStatus();
        });
        //  Register call handlers for exposed instance's method
        if (this._exposedInstance) {
            const asPrototype = this._emitter as unknown as Prototype;
            const methodNames = getInstanceMethodNames(this._exposedInstance as object, asPrototype.prototype);
            // Register handlers for functions of service's Implementation (except the ones inherited from EventEmitter)
            // Looking in legacy class
            for (const [methodName, methodDesc] of methodNames) {
                this.registerCallHandler(methodName, methodDesc.value);
            }
        } else {
            this._logger?.info(`[IpcService] Service '${this._serviceName}' does NOT have an implementation`);
        }
    }

    private _getServiceStatus(): ServiceStatus {
        const callChannel = getServiceCallChannel(this._serviceName);
        const serviceStatus: ServiceStatus = {
            started: this._ipcBusClient.listenerCount(callChannel) > 0,
            callHandlers: this._getCallHandlerNames(),
            supportEventEmitter: this._prevImplEmit !== undefined,
        };
        return serviceStatus;
    }

    start(): void {
        if (this._exposedInstance && this._exposedInstance['emit']) {
            // Hook events emitted by implementation to send them via IPC
            this._prevImplEmit = this._exposedInstance['emit'];
            this._exposedInstance['emit'] = (eventName: string, ...args: any[]) => {
                this._logger?.info(`[IpcService] Service '${this._serviceName}' is emitting event '${eventName}'`);

                // Emit the event on IPC
                this.sendEvent(ServiceConstants.IPCBUS_SERVICE_WRAPPER_EVENT, eventName, args);
                // Emit the event as usual in the context of the _exposedInstance
                return this._prevImplEmit.call(this._exposedInstance, eventName, ...args);
            };

            this._logger?.info(
                `[IpcService] Service '${this._serviceName}' will send events emitted by its implementation`
            );
        }

        // Listening to call messages
        // Manage re-entrance
        const callChannel = getServiceCallChannel(this._serviceName);
        this._ipcBusClient.removeListener(callChannel, this._onCallReceived);
        this._ipcBusClient.addListener(callChannel, this._onCallReceived);

        // The service is started, send available call handlers to clients
        this.sendEvent(ServiceConstants.IPCBUS_SERVICE_EVENT_START, this._getServiceStatus());

        this._logger?.info(`[IpcService] Service '${this._serviceName}' is STARTED`);
    }

    stop(): void {
        if (this._exposedInstance && this._prevImplEmit) {
            // Unhook events emitted by implementation to send them via IPC
            this._exposedInstance['emit'] = this._prevImplEmit;
            this._prevImplEmit = null;
        }

        // The service is stopped
        this.sendEvent(ServiceConstants.IPCBUS_SERVICE_EVENT_STOP, {});

        // No more listening to call messages
        const callChannel = getServiceCallChannel(this._serviceName);
        this._ipcBusClient.removeListener(callChannel, this._onCallReceived);

        this._logger?.info(`[IpcService] Service '${this._serviceName}' is STOPPED`);
    }

    registerCallHandler(name: string, handler: Function): void {
        this._callHandlers.set(name, handler);
        this._logger?.info(`[IpcService] Service '${this._serviceName}' registered call handler '${name}'`);
    }

    unregisterCallHandler(name: string): void {
        this._callHandlers.delete(name);
        this._logger?.info(`[IpcService] Service '${this._serviceName}' unregistered call handler '${name}'`);
    }

    sendEvent(name: string, ...args: any[]): void {
        const eventMsg: IpcBusServiceEvent = { eventName: name, args: args };
        this._ipcBusClient.send(getServiceEventChannel(this._serviceName), eventMsg);
    }

    private _onCallReceived(event: IpcBusEvent, call: IpcBusServiceCall) {
        this._logger?.info(
            `[IpcService] Service '${this._serviceName}' is calling implementation's '${call.handlerName}'`
        );
        const callHandler: Function = this._callHandlers.get(call.handlerName);
        try {
            if (!callHandler) {
                throw `Function unknown !`;
            } else {
                const result = callHandler.apply(this._exposedInstance, call.args);
                if (event.request) {
                    if (result && result['then']) {
                        // result is a valid promise
                        result.then(event.request.resolve, event.request.reject);
                    } else {
                        // result is "just" a value
                        event.request.resolve(result);
                    }
                }
            }
        } catch (e) {
            this._logger?.error(`[IpcService] Service '${this._serviceName}' encountered an exception \
                while processing call to '${call.handlerName}' : ${e}`);
            if (event.request) {
                event.request.reject(e);
            }
        }
    }

    private _getCallHandlerNames(): Array<string> {
        // Remove __getServiceStatus and any internal hidden functions
        const callHandlerNames = Array.from(this._callHandlers.keys()).filter((name) => name[0] !== '_');
        return callHandlerNames;
    }
}
