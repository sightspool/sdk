import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
// Opt-in only after the main website docs have passed hosted acceptance.
// Exact documentation files only. Never redirect release or machine-readable files.
export const documentationRedirects = {
  'index.html': 'https://research.justusability.com/sdk',
  'trust.html': 'https://research.justusability.com/sdk/data-security',
  'demo.html': 'https://research.justusability.com/sdk/demo',
};
export function stageDocumentationRedirects(directory) {
  for (const [file, destination] of Object.entries(documentationRedirects)) {
    writeFileSync(join(directory, file), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Justusability SDK documentation has moved</title><link rel="canonical" href="${destination}"><meta http-equiv="refresh" content="0;url=${destination}"></head><body><p>The SDK documentation is now part of the Justusability website.</p><p><a href="${destination}">Continue to the documentation</a></p><script>location.replace(${JSON.stringify(destination)} + location.search + location.hash);</script></body></html>\n`);
  }
}
