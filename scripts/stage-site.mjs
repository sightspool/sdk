import { stageDocumentationRedirects } from './docs-redirects.mjs';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { verifyRelease } from './verify-release.mjs';
const manifest = verifyRelease('dist');
rmSync('.site-build',{recursive:true,force:true});
cpSync('site','.site-build',{recursive:true});
cpSync('llms.txt','.site-build/llms.txt');
cpSync('dist/release.json','.site-build/release.json');
const directory = join('.site-build',dirname(manifest.bundle.path));
mkdirSync(directory,{recursive:true});
for (const file of ['sdk.global.js','sdk.global.js.map','source.json','release.json']) cpSync(join('dist',file),join(directory,file));
console.log('Staged existing sdk.sightspool.com site with verified release files.');

if (process.argv.includes('--redirect-docs')) {
  stageDocumentationRedirects('.site-build');
  console.log('Documentation-only compatibility redirects staged; release and machine-readable URLs preserved.');
}
