import { mkdirSync, existsSync } from 'fs';
import * as util from 'util';

const CutMarker = "'__cut__'";

export function ensureDirSync(path: string): void {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

export function jsonStringify(data: unknown, maxLen: number): string {
    let output = '';
    switch (typeof data) {
        case 'object':
            if (Buffer.isBuffer(data)) {
                if (data.length > maxLen * 2) {
                    output = data.toString('utf8', 0, maxLen) + CutMarker;
                } else {
                    output = data.toString('utf8', 0, maxLen);
                }
            } else if (Array.isArray(data)) {
                // eslint-disable-next-line no-use-before-define
                output = stringifyJsonArray(data, maxLen, output);
            } else if (util.types.isDate(data)) {
                output = data.toISOString();
            } else {
                // eslint-disable-next-line no-use-before-define
                output = jsonStringifyObject(data, maxLen, output);
            }
            break;
        case 'string':
            // eslint-disable-next-line no-use-before-define
            output = jsonStringifyString(data, maxLen);
            break;
        case 'number':
            output = data.toString();
            break;
        case 'boolean':
            output = data ? 'true' : 'false';
            break;
        case 'undefined':
            output = '__undefined__';
            break;
    }
    return output;
}

export function stringifyJsonArray(data: unknown[], maxLen: number, output: string): string {
    output += '[';
    for (let i = 0, l = data.length; i < l; ++i) {
        if (output.length >= maxLen) {
            output += CutMarker;
            break;
        }
        output += jsonStringify(data[i], maxLen - output.length);
        output += ',';
    }
    output += ']';
    return output;
}

export function jsonStringifyObject(data: unknown, maxLen: number, output: string): string {
    output += '{';
    if (data) {
        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; ++i) {
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            const key = keys[i];
            output += key + ': ';
            if (output.length >= maxLen) {
                output += CutMarker;
                break;
            }
            output += jsonStringify((data as Record<string, unknown>)[key], maxLen - output.length);
            output += ',';
        }
    } else {
        output += 'null';
    }
    output += '}';
    return output;
}

export function jsonStringifyString(data: string, maxLen: number): string {
    // output = data.substr(0, maxLen).replace(/(\r\n|\n|\r|\t)/gm, ' ');
    if (data.length > maxLen) {
        return data.substring(0, maxLen) + CutMarker;
    }
    return data;
}

export function cutData(data: unknown, maxLen: number): unknown {
    switch (typeof data) {
        case 'object':
        case 'string':
            return jsonStringify(data, maxLen);
        // case 'number':
        // case 'boolean':
        // case 'undefined':
        default:
            return data;
    }
}
