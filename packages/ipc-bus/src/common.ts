import {
    ConnectionState as ConnectCloseState,
    CheckConnectOptions as ParseConnectOptions,
} from '@electron-common-ipc/universal';

import { isIpcAvailable as IsElectronCommonIpcAvailable } from './renderer/IpcBusWindowNamespace';
import {
    newIpcBusService as CreateIpcBusService,
    newIpcBusServiceProxy as CreateIpcBusServiceProxy,
} from './service/IpcBusService-factory';
import { activateIpcBusTrace as ActivateIpcBusTrace, activateServiceTrace as ActivateServiceTrace } from './utils/log';

export {
    ActivateIpcBusTrace,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
    ActivateServiceTrace,
    IsElectronCommonIpcAvailable,
    ConnectCloseState,
    ParseConnectOptions,
};
