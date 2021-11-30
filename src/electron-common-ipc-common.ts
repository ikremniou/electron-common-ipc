export * from './IpcBus/IpcBusClient';

export * from './IpcBus/service/IpcBusService';
export * from './IpcBus/service/IpcBusService-factory';

// export * from './IpcBus/renderer/IpcBusRendererPreload';

export { ActivateIpcBusTrace, ActivateServiceTrace, ConnectCloseState } from './IpcBus/IpcBusUtils';

// Force to execute code
/** @internal */
import './IpcBus/service/IpcBusService-factory';