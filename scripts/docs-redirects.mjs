import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Opt-in only after the main website docs have passed hosted acceptance.
// Exact documentation files only. Never redirect release or machine-readable files.
export const documentationRedirects = {
  'index.html': 'https://www.sightspool.com/sdk',
  'trust.html': 'https://www.sightspool.com/sdk/data-security',
  'demo.html': 'https://www.sightspool.com/sdk/demo',
};
export function stageDocumentationRedirects(directory) {
  for (const [file, destination] of Object.entries(documentationRedirects)) {
    writeFileSync(join(directory, file), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sightspool SDK documentation has moved</title><link rel="canonical" href="${destination}"><meta http-equiv="refresh" content="0;url=${destination}"></head><body><p>The SDK documentation is now part of the Sightspool website.</p><p><a href="${destination}">Continue to the documentation</a></p><script>location.replace(${JSON.stringify(destination)} + location.search + location.hash);</script></body></html>\n`);
  }
}
