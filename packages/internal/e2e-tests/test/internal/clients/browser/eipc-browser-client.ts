import {
    ActivateServiceTrace,
    CreateIpcBusClient,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
} from 'electron-common-ipc';

import { bootstrap } from './browser-client-base';

ActivateServiceTrace(window.e2eIpc.shouldLog);
bootstrap(CreateIpcBusClient as never, CreateIpcBusService as never, CreateIpcBusServiceProxy as never, );
