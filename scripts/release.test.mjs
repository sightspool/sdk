import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRelease } from './verify-release.mjs';
for (const file of ['sdk.global.js', 'source.json', 'release.json']) {
  test(`release verification rejects changed ${file}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'sightspool-release-'));
    try {
      cpSync('dist', dir, {recursive:true});
      assert.equal(verifyRelease(dir).package, '@sightspool/sdk');
      if(file === 'release.json') {
        const manifest = JSON.parse(readFileSync(join(dir,file),'utf8'));
        manifest.bundle.path = 'releases/latest/sdk.global.js';
        writeFileSync(join(dir,file),JSON.stringify(manifest));
      } else writeFileSync(join(dir,file), readFileSync(join(dir,file),'utf8') + 'tampered');
      assert.throws(() => verifyRelease(dir));
    } finally { rmSync(dir,{recursive:true,force:true}); }
  });
}
test('release verification rejects a tag for another version', () => assert.throws(() => verifyRelease('dist','v999.0.0')));
