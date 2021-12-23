export * from './electron-common-ipc-common';

export * from './IpcBus/IpcBusClient-factory';

export * from './IpcBus/node/IpcBusBroker';
export * from './IpcBus/node/IpcBusBroker-factory';

export * from './IpcBus/node/IpcBusClientSocket';

export * from './IpcBus/main/IpcBusBridge';
export * from './IpcBus/main/IpcBusBridge-factory';

export * from './IpcBus/log/IpcBusLogConfig';
export * from './IpcBus/log/IpcBusCSVLogger-main';
export * from './IpcBus/log/IpcBusJSONLogger-main';

export * from './IpcBus/log/IpcBusLog-factory';

// export { GetWindowTarget, GetProcessTarget } from './IpcBus/main/IpcBusClientMain-factory';

// Force to execute code
/** @internal */
import './IpcBus/IpcBusClient-factory';
/** @internal */
import './IpcBus/node/IpcBusBroker-factory';
/** @internal */
import './IpcBus/main/IpcBusBridge-factory';
/** @internal */
import './IpcBus/node/IpcBusClientSocket-factory';
/** @internal */
import './IpcBus/log/IpcBusCSVLogger-main';
/** @internal */
import './IpcBus/log/IpcBusJSONLogger-main';
/** @internal */
import './IpcBus/log/IpcBusLogConfigMain';


// /** @internal */
// import { IpcBusLog } from './IpcBus/log/IpcBusLog';

// if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_CSV']) {
//     IpcBusLog.SetLogLevelCVS(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_CSV']);
// }

// if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_JSON']) {
//     IpcBusLog.SetLogLevelJSON(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_JSON']);
// }
