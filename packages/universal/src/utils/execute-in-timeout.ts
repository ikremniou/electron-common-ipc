type RejectType = (reason?: unknown) => void;
type ResolveType<T> = (value: T | PromiseLike<T>) => void;
type ExecutorType<T> = (resolve: ResolveType<T>, reject: RejectType) => void;

export function executeInTimeout<T>(
    timeoutDelay: number,
    func: ExecutorType<T>,
    timeout: (reject: RejectType) => void
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (timeoutDelay !== undefined && timeoutDelay >= 0) {
            const timerId: ReturnType<typeof setTimeout> = setTimeout(() => {
                timeout(reject);
            }, timeoutDelay);

            const clearTimer = () => {
                if (timerId) {
                    clearTimeout(timerId);
                }
            };

            const resolveWrapper: ResolveType<T> = (value) => {
                clearTimer();
                resolve(value);
            };

            const rejectWrapper: RejectType = (reason) => {
                clearTimer();
                reject(reason);
            };
            func(resolveWrapper, rejectWrapper);
        } else {
            func(resolve, reject);
        }
    });
}
