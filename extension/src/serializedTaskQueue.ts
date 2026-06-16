export interface SerializedTaskQueue {
  enqueue<T>(key: string, task: () => Promise<T> | T): Promise<T>;
}

export type SerializedTaskQueueErrorReporter = (key: string, error: unknown) => void;

export function createSerializedTaskQueue(reportError?: SerializedTaskQueueErrorReporter): SerializedTaskQueue {
  const tails = new Map<string, Promise<void>>();

  return {
    enqueue<T>(key: string, task: () => Promise<T> | T): Promise<T> {
      const previous = tails.get(key) ?? Promise.resolve();
      const run = previous.catch(() => undefined).then(task);
      const tail = run.then(
        () => undefined,
        (error: unknown) => {
          reportError?.(key, error);
        }
      );

      tails.set(key, tail);
      void tail.finally(() => {
        if (tails.get(key) === tail) {
          tails.delete(key);
        }
      });

      return run;
    }
  };
}
