export function defer<T>(callback: () => T, timeoutMs: number): Promise<T> | T {
    return new Promise(resolve => setTimeout(resolve, timeoutMs)).then(callback);
}
