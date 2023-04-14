import { ContractLogLevel, GlobalContainer, IpcBusProcessType, MessageStampImpl } from '@electron-common-ipc/universal';
import * as path from 'path';

import { IpcBusBridgeImpl } from './IpcBusBridgeImpl';
import { IpcBusBridgeLogger } from './IpcBusBridgeLogger';
import { setLogLevelCVS } from '../log/IpcBusCSVLogger-main';
import { setLogLevelJSON } from '../log/IpcBusJSONLogger-main';
import { CreateIpcBusLog } from '../log/IpcBusLog-factory-main';
import { uuidProvider } from '../utils/uuid';

import type { IpcBusBridge } from './IpcBusBridge';
import type { IpcBusLogMain } from '../log/IpcBusLogConfig-main';

function newIpcBusBridgeInternal(): IpcBusBridge {
    const contractLogger = CreateIpcBusLog() as IpcBusLogMain;
    // For backward
    if (process.env['ELECTRON_IPC_LOG_CSV']) {
        if (contractLogger.level === ContractLogLevel.None) {
            contractLogger.level = ContractLogLevel.Args;
        }
        if (contractLogger.argMaxContentLen < 0) {
            contractLogger.argMaxContentLen = 255;
        }
        const filename = path.join(process.env['ELECTRON_IPC_LOG_CSV'], 'electron-common-ipc.csv');
        setLogLevelCVS(contractLogger.level, filename, contractLogger.argMaxContentLen);
    }
    // For backward
    if (process.env['ELECTRON_IPC_LOG_JSON']) {
        if (contractLogger.level === ContractLogLevel.None) {
            contractLogger.level = ContractLogLevel.Args;
        }
        if (contractLogger.argMaxContentLen < 0) {
            contractLogger.argMaxContentLen = 255;
        }
        const filename = path.join(process.env['ELECTRON_IPC_LOG_JSON'], 'electron-common-ipc.json');
        setLogLevelJSON(contractLogger.level, filename, contractLogger.argMaxContentLen);
    }
    let bridge: IpcBusBridge;
    if (contractLogger.level > ContractLogLevel.None) {
        bridge = new IpcBusBridgeLogger(
            IpcBusProcessType.Main,
            contractLogger,
            uuidProvider,
            new MessageStampImpl(contractLogger)
        );
    } else {
        bridge = new IpcBusBridgeImpl(IpcBusProcessType.Main, uuidProvider);
    }
    return bridge;
}

const gBridgeSymbolName = 'IpcBusBridge';
export function newIpcBusBridge(): IpcBusBridge {
    const globalContainer = new GlobalContainer();
    let gBridge = globalContainer.getSingleton<IpcBusBridge>(gBridgeSymbolName);
    // Beware, we test 'undefined' here
    if (gBridge === undefined) {
        // IpcBusUtils.Logger.enable &&
        //    IpcBusUtils.Logger.info(`CreateIpcBusBridge process type = ${electronProcessType}`);
        gBridge = newIpcBusBridgeInternal();
        globalContainer.registerSingleton(gBridgeSymbolName, gBridge);
    }
    return gBridge;
}
