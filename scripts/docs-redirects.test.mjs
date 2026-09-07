import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageDocumentationRedirects, documentationRedirects } from './docs-redirects.mjs';
test('documentation migration preserves release, source, script and machine-readable files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sdk-doc-redirects-'));
  try {
    mkdirSync(join(dir, 'releases/0.4.0/artifact'), {recursive:true});
    const assets = ['release.json', 'llms.txt', 'sdk.global.js', 'releases/0.4.0/artifact/source.json'];
    for (const file of assets) writeFileSync(join(dir,file), 'unchanged');
    stageDocumentationRedirects(dir);
    for (const file of assets) assert.equal(readFileSync(join(dir,file),'utf8'), 'unchanged');
    assert.deepEqual(Object.keys(documentationRedirects), ['index.html','trust.html','demo.html']);
    for (const [file,url] of Object.entries(documentationRedirects)) {
      const html = readFileSync(join(dir,file),'utf8');
      assert.ok(html.includes(`href="${url}"`));
      assert.ok(html.includes('location.search + location.hash'));
    }
  } finally { rmSync(dir, {recursive:true,force:true}); }
});
