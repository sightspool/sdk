import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const hash = (data, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(data).digest(encoding);
export function verifyRelease(directory, tag) {
  const manifest = JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8'));
  const bundle = readFileSync(join(directory, 'sdk.global.js'));
  const source = readFileSync(join(directory, 'source.json'));
  if (hash(bundle) !== manifest.bundle.sha256 || 'sha384-' + hash(bundle, 'sha384', 'base64') !== manifest.bundle.integrity || bundle.length !== manifest.bundle.bytes) throw Error('Bundle integrity mismatch');
  if (hash(source) !== manifest.source.sha256) throw Error('Source snapshot integrity mismatch');
  const artifactId = hash(JSON.stringify([manifest.version, manifest.bundle.sha256, manifest.source.sha256, manifest.sourceCommit, manifest.sourceDirty]));
  if (manifest.artifactId !== artifactId) throw Error('Release identity mismatch');
  if (manifest.bundle.path !== `releases/${manifest.version}/${artifactId}/sdk.global.js`) throw Error('Versioned path mismatch');
  const pkg = JSON.parse(JSON.parse(source).files['package.json']);
  if (pkg.version !== manifest.version || pkg.name !== manifest.package) throw Error('Source package mismatch');
  if (tag && (tag !== `v${manifest.version}` || manifest.sourceDirty)) throw Error('Release needs matching version tag and clean source');
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = verifyRelease('dist', process.argv[2]);
  console.log(`Verified ${result.package}@${result.version}: bundle, SRI, source snapshot and versioned path.`);
}
