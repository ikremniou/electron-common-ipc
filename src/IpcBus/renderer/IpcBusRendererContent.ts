import * as util from 'util';

import type { IpcPacketBufferCore } from 'socket-serializer';
// import * as zlib from 'zlib';

// const threshold = 4000000;

/** @internal */
export interface IpcBusRendererContent extends IpcPacketBufferCore.RawData {
    // compressed: boolean;
}

// export interface IpcBusContent extends IpcBusRendererContent {
//     bufferCompressed?: Buffer;
// }


// See https://github.com/feross/typedarray-to-buffer/blob/master/index.js
// see https://www.electronjs.org/docs/breaking-changes#behavior-changed-values-sent-over-ipc-are-now-serialized-with-structured-clone-algorithm
// see https://github.com/electron/electron/pull/20214
// To avoid a copy, use the typed array's underlying ArrayBuffer to back new Buffer

/** @internal */
export namespace IpcBusRendererContent {
    export function Uint8ArrayToBuffer(rawBuffer: Buffer | Uint8Array): Buffer {
        if (util.types.isUint8Array(rawBuffer)) {
            return Buffer.from(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);
        }
        return rawBuffer;
    }

    export function FixRawContent(rawData: IpcPacketBufferCore.RawData, forceSingleBuffer?: boolean) {
        if (rawData.buffer) {
            rawData.buffer = Uint8ArrayToBuffer(rawData.buffer);
        }
        else if (Array.isArray(rawData.buffers)) {
            for (let i = 0, l = rawData.buffers.length; i < l; ++i) {
                rawData.buffers[i] = Uint8ArrayToBuffer(rawData.buffers[i]);
            }
            if (forceSingleBuffer) {
                rawData.buffer = Buffer.concat(rawData.buffers);
                rawData.buffers = undefined;
            }
        }
    }

    // export function PackRawContent(buffRawContent: IpcPacketBuffer.RawData): IpcBusRendererContent {
    //     const rawData = buffRawContent as IpcBusRendererContent;
    //     // if ((rawData.buffer.length > threshold) && !rawData.compressed) {
    //     //     rawData.compressed = true;
    //     //     rawData.buffer = CompressBuffer(rawData.buffer);
    //     // }
    //     return rawData;
    // }

    // export function UnpackRawContent(rawData: IpcBusRendererContent) {
    //     // if (rawData.compressed) {
    //     //     rawData.compressed = false;
    //     //     rawData.buffer = DecompressBuffer(rawData.buffer);
    //     // }
    //     return rawData;
    // }
}

// CompressBuffer;
// function CompressBuffer(buff: Buffer): Buffer {
//     return zlib.gzipSync(buff, {
//         chunkSize: 65536
//     });
// }

// DecompressBuffer;
// function DecompressBuffer(buff: Buffer): Buffer {
//     return zlib.gunzipSync(buff, {
//         chunkSize: 65536
//     });
// }

