import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
const digest = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const bundle = readFileSync('dist/sdk.global.js');
const sourceFiles = ['src/index.ts', 'src/browser.ts', 'src/research.ts', 'tsup.config.ts', 'package.json', 'pnpm-lock.yaml', 'scripts/build-release.mjs'];
const files = Object.fromEntries(sourceFiles.map(path => [path, readFileSync(path, 'utf8')]));
const source = JSON.stringify({ files }, null, 2) + '\n';
const sha256 = digest(bundle);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const sourceDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {encoding:'utf8'}).trim());
const artifactId = digest(JSON.stringify([pkg.version, sha256, digest(source), sourceCommit, sourceDirty]));
const manifest = {
  schemaVersion: 1, package: pkg.name, version: pkg.version,
  sourceCommit, sourceDirty, artifactId,
  bundle: { file: 'sdk.global.js', path: `releases/${pkg.version}/${artifactId}/sdk.global.js`, sha256,
    integrity: 'sha384-' + digest(bundle, 'sha384', 'base64'), bytes: bundle.length, gzipBytes: gzipSync(bundle).length },
  source: { file: 'source.json', sha256: digest(source) },
  runtimeDependencies: Object.keys(pkg.dependencies || {}),
};
writeFileSync('dist/source.json', source);
writeFileSync('dist/release.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${pkg.name} ${pkg.version}: ${bundle.length} bytes, ${manifest.bundle.gzipBytes} gzip bytes. No publication performed.`);
