"""Render the small SDK README using the documentation site's existing styles."""
from pathlib import Path
import html
import re

root = Path(__file__).resolve().parent.parent
page = root / 'site/index.html'
old = page.read_text()
style = old[old.index('<style>'):old.index('</style>') + 8]

def inline(value):
    value = html.escape(value)
    value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
    value = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)
    return value

lines = (root / 'README.md').read_text().splitlines()
body = []
i = 0
while i < len(lines):
    line = lines[i]
    if not line:
        i += 1
        continue
    if line.startswith('```'):
        code = []
        i += 1
        while i < len(lines) and not lines[i].startswith('```'):
            code.append(lines[i]); i += 1
        body.append('<pre><code>' + html.escape('\n'.join(code)) + '</code></pre>')
    elif line.startswith('# '):
        body.append('<header><h1>' + inline(line[2:]) + '</h1></header>')
    elif line.startswith('## '):
        body.append('<h2>' + inline(line[3:]) + '</h2>')
    elif line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            if not re.fullmatch(r'[| :\-]+', lines[i]):
                cells = lines[i].strip('|').split('|')
                tag = 'th' if not rows else 'td'
                rows.append('<tr>' + ''.join(f'<{tag}>' + inline(cell.strip()) + f'</{tag}>' for cell in cells) + '</tr>')
            i += 1
        body.append('<table>' + ''.join(rows) + '</table>')
        continue
    else:
        paragraph = [line]
        while i + 1 < len(lines) and lines[i + 1] and not lines[i + 1].startswith(('#', '```', '|')):
            i += 1; paragraph.append(lines[i])
        body.append('<p>' + inline(' '.join(paragraph)) + '</p>')
    i += 1
page.write_text('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sightspool research SDK</title>' + style + '</head><body><main class="wrap">' + '\n'.join(body) + '</main></body></html>\n')
