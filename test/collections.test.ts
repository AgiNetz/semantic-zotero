import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionPath } from '../src/ui/add-dialog';

test('collectionPath: subcollections show their parents', () => {
  const all = [
    { id: 1, name: 'Thesis', parentID: false as const },
    { id: 2, name: 'Related work', parentID: 1 },
    { id: 3, name: 'Methods', parentID: 2 },
  ];
  assert.equal(collectionPath(all[0], all), 'Thesis');
  assert.equal(collectionPath(all[2], all), 'Thesis › Related work › Methods');
});
