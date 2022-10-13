export * from './index-common';
export * from './renderer/IpcBusWindowNamespace';

export * from './client/IpcBusClient';

export * from './service/IpcBusService';
export * from './service/IpcBusService-factory';

export * from './log/IpcBusLog';

export { ActivateIpcBusTrace, ActivateServiceTrace, ConnectCloseState } from './utils';

// Force to execute code
/** @internal */
import './service/IpcBusService-factory';