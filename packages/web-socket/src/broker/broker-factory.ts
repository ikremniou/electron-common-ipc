import { GlobalContainer } from '@electron-common-ipc/universal';
import { JSONParserV1 } from 'json-helpers';

import { createWebSocketBroker as createThin } from './broker-factory-thin';

import type { ThinContext } from './broker-factory-thin';
import type { IpcBusBroker } from '@electron-common-ipc/universal';

export function createWebSocketBroker(ctx?: Partial<ThinContext>): IpcBusBroker {
    const defaultCtx = {
        json: JSONParserV1,
        container: new GlobalContainer(),
    };
    const mergedCtx = ctx
        ? {
              ...defaultCtx,
              ...ctx,
          }
        : defaultCtx;
    return createThin(mergedCtx);
}
