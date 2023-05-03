import {
    ActivateIpcBusTrace,
    CreateIpcBusClient,
    CreateIpcBusService,
    CreateIpcBusServiceProxy,
} from 'electron-common-ipc';

import { bootstrap } from './bus-echo-client-base';
import { isLogEnabled } from '../utils';

ActivateIpcBusTrace(isLogEnabled());

bootstrap(CreateIpcBusClient as never, CreateIpcBusService as never, CreateIpcBusServiceProxy as never);
