import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createTrainingFileStore } from '../src/training/fileSystemProvider';

describe('training file store', () => {
  it('seeds, reads, writes, renames, and deletes virtual lesson files', () => {
    const store = createTrainingFileStore();

    store.seed('code-trainer:/lesson/java-class-basic-01', 'class Demo {}');
    assert.equal(Buffer.from(store.readFile('code-trainer:/lesson/java-class-basic-01')).toString('utf8'), 'class Demo {}');

    store.writeFile('code-trainer:/lesson/java-class-basic-01', Buffer.from('updated', 'utf8'));
    assert.equal(Buffer.from(store.readFile('code-trainer:/lesson/java-class-basic-01')).toString('utf8'), 'updated');

    store.rename('code-trainer:/lesson/java-class-basic-01', 'code-trainer:/lesson/java-class-basic-02');
    assert.equal(Buffer.from(store.readFile('code-trainer:/lesson/java-class-basic-02')).toString('utf8'), 'updated');

    store.delete('code-trainer:/lesson/java-class-basic-02');
    assert.throws(() => store.readFile('code-trainer:/lesson/java-class-basic-02'), /File not found/);
  });
});
