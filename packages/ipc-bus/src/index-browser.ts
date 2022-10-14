export * from './index-common';

export * from './client/IpcBusClient-factory-browser';

export * from './log/IpcBusLog-factory-browser';

export * from './service/IpcBusService-factory-browser';

// Force to execute code
/** @internal */
import './client/IpcBusClient-factory-browser';
/** @internal */
import './log/IpcBusLog-factory-browser';
/** @internal */
import './service/IpcBusService-factory-browser';
