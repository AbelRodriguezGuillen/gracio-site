"""Builds gracio-site/src/open-source.html: every library shipped in the app, its license and copyright line."""
# Run: python3 tools/credits.py <path to the gracio app repo, after npm ci> src/open-source.html, then python3 build.py.
import json, os, re, html, glob, sys
APP = sys.argv[1]; OUT = sys.argv[2]
nm = os.path.join(APP, 'node_modules')
def pkg(name):
    p = os.path.join(nm, name, 'package.json')
    return json.load(open(p)) if os.path.exists(p) else None
deps = json.load(open(os.path.join(APP, 'package.json')))['dependencies']
seen = {}; stack = list(deps)
while stack:
    n = stack.pop()
    if n in seen: continue
    j = pkg(n)
    if not j: continue
    lic = j.get('license') or j.get('licenses') or 'See package'
    if isinstance(lic, dict): lic = lic.get('type')
    if isinstance(lic, list): lic = ' OR '.join(l.get('type', '?') if isinstance(l, dict) else str(l) for l in lic)
    # copyright line from the package's license file
    cr = ''
    for f in sorted(glob.glob(os.path.join(nm, n, '[Ll][Ii][Cc][Ee][Nn][CcSs][Ee]*')) + glob.glob(os.path.join(nm, n, 'COPYING*'))):
        try: t = open(f, errors='ignore').read()
        except Exception: continue
        m = re.search(r'^\s*(?:\(c\)|©)?\s*Copyright[^\n]{0,160}', t, re.I | re.M)
        if m: cr = ' '.join(m.group(0).split()); break
    if not cr:
        a = j.get('author')
        a = a.get('name') if isinstance(a, dict) else a
        if a: cr = f'Copyright {a}'
    seen[n] = (j.get('version', ''), str(lic), cr)
    stack += list((j.get('dependencies') or {}).keys())
rows = '\n'.join(f'<li><strong>{html.escape(n)}</strong> {html.escape(v)} · {html.escape(l)}{"<br><small>" + html.escape(c) + "</small>" if c else ""}</li>'
                 for n, (v, l, c) in sorted(seen.items(), key=lambda x: x[0].lower()))
MIT = """Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."""
page = f'''<!-- title: Open-source software · Gracio -->
<!-- description: The open-source software and fonts Gracio uses, and their licenses. -->
<main class="wrap doc">
<h1>Open-source software</h1>
<p>Gracio is built with open-source software. Thank you to everyone who makes it. Below is each library in the Gracio app, its version, its license and its copyright notice. The full text of each license comes with the library and is available from its project page or on <a href="https://www.npmjs.com">npmjs.com</a>.</p>

<h2>Fonts</h2>
<ul>
<li><strong>Cormorant SC</strong> · Copyright 2015 the Cormorant Project Authors · SIL Open Font License 1.1 · <a href="/assets/fonts/OFL.txt">license text</a></li>
</ul>

<h2>Libraries in the app ({len(seen)})</h2>
<ul class="credits">
{rows}
</ul>

<h2>MIT License</h2>
<p>Most of these libraries use the MIT License, which reads, with each library's own copyright notice above:</p>
<pre class="license">{html.escape(MIT)}</pre>
</main>
'''
open(OUT, 'w').write(page)
print(len(seen), 'libraries;', sum(1 for v in seen.values() if v[2]), 'with a copyright line')
