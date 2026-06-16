import fs from 'node:fs';
import * as path from 'node:path';
import Mocha from 'mocha';

export function run(): Promise<void> {
  const mocha = new Mocha({
    color: true,
    retries: 1,
    timeout: 30_000,
    ui: 'bdd'
  });

  for (const file of fs.readdirSync(__dirname).filter((candidate) => candidate.endsWith('.e2e.js')).sort()) {
    mocha.addFile(path.resolve(__dirname, file));
  }

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) {
        reject(new Error(`${failures} e2e test failure${failures === 1 ? '' : 's'}`));
        return;
      }

      resolve();
    });
  });
}
