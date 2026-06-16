import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createSerializedTaskQueue } from '../src/serializedTaskQueue';

describe('serialized task queue', () => {
  it('runs tasks for the same key one at a time in enqueue order', async () => {
    const queue = createSerializedTaskQueue();
    const releaseFirst = deferred<void>();
    const events: string[] = [];

    const first = queue.enqueue('document-a', async () => {
      events.push('first:start');
      await releaseFirst.promise;
      events.push('first:end');
    });
    const second = queue.enqueue('document-a', async () => {
      events.push('second');
    });

    await delay(0);
    assert.deepEqual(events, ['first:start']);

    releaseFirst.resolve();
    await Promise.all([first, second]);

    assert.deepEqual(events, ['first:start', 'first:end', 'second']);
  });

  it('lets different keys run independently', async () => {
    const queue = createSerializedTaskQueue();
    const releaseFirst = deferred<void>();
    const events: string[] = [];

    const blocked = queue.enqueue('document-a', async () => {
      events.push('a:start');
      await releaseFirst.promise;
      events.push('a:end');
    });
    const independent = queue.enqueue('document-b', async () => {
      events.push('b');
    });

    await independent;
    assert.deepEqual(events, ['a:start', 'b']);

    releaseFirst.resolve();
    await blocked;
    assert.deepEqual(events, ['a:start', 'b', 'a:end']);
  });

  it('surfaces task failures and keeps later tasks for that key running', async () => {
    const queue = createSerializedTaskQueue();
    const failure = new Error('write failed');

    await assert.rejects(
      queue.enqueue('document-a', async () => {
        throw failure;
      }),
      (error: unknown) => {
        assert.equal(error, failure);
        return true;
      }
    );

    const result = await queue.enqueue('document-a', async () => 42);

    assert.equal(result, 42);
  });

  it('observes previous task failures exactly once before continuing the key queue', async () => {
    const errors: string[] = [];
    const queue = createSerializedTaskQueue((key, error) => {
      errors.push(`${key}:${error instanceof Error ? error.message : String(error)}`);
    });

    await assert.rejects(
      queue.enqueue('document-a', async () => {
        throw new Error('write failed');
      }),
      /write failed/
    );
    assert.equal(await queue.enqueue('document-a', async () => 42), 42);

    assert.deepEqual(errors, ['document-a:write failed']);
  });
});

function deferred<T>(): { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void } {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
