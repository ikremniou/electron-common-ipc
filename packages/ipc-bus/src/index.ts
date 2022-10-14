export * from './index-common';

export * from './client/IpcBusClient-factory';

export * from './node/IpcBusBroker';
export * from './node/IpcBusBroker-factory';

export * from './node/IpcBusClientSocket';

export * from './main/IpcBusBridge';
export * from './main/IpcBusBridge-factory';

export * from './log/IpcBusLogConfig';
export * from './log/IpcBusCSVLogger-main';
export * from './log/IpcBusJSONLogger-main';

export * from './log/IpcBusLog-factory';

// Force to execute code
/** @internal */
import './client/IpcBusClient-factory';
/** @internal */
import './node/IpcBusBroker-factory';
/** @internal */
import './main/IpcBusBridge-factory';
/** @internal */
import './node/IpcBusClientSocket-factory';
/** @internal */
import './log/IpcBusCSVLogger-main';
/** @internal */
import './log/IpcBusJSONLogger-main';
/** @internal */
import './log/IpcBusLogConfigMain';


// /** @internal */
// import { IpcBusLog } from './log/IpcBusLog';

// if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_CSV']) {
//     IpcBusLog.SetLogLevelCVS(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_CSV']);
// }

// if (process && process.env && process.env['ELECTRON_IPC_LOG'] && process.env['ELECTRON_IPC_LOG_JSON']) {
//     IpcBusLog.SetLogLevelJSON(Number(process.env['ELECTRON_IPC_LOG']), process.env['ELECTRON_IPC_LOG_JSON']);
// }
