"""Builds the site: wraps each page in src/ with the shared head, header and footer.

Run `python3 build.py` after editing anything in src/. Each src page starts with two lines:
  <!-- title: Page title -->
  <!-- description: One sentence for search results -->
`{{butler}}` inserts the mascot drawing (assets/butler.svg).
"""
import pathlib, re

ROOT = pathlib.Path(__file__).parent
SITE = 'https://gracioapp.com'
BUTLER = (ROOT / 'assets' / 'butler.svg').read_text()
NAV = [('/support.html', 'Support'), ('/privacy.html', 'Privacy'), ('/terms.html', 'Terms')]


def head(title, desc, path):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{SITE}{path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{path}">
<meta name="theme-color" content="#EEF5FA">
<link rel="preload" href="/assets/fonts/cormorant-sc-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
'''


def top(path):
    links = ''.join(f'<a href="{h}"{" aria-current=\"page\"" if h == path else ""}>{label}</a>' for h, label in NAV)
    return f'''<header class="top"><div class="wrap">
  <a class="brand" href="/" aria-label="Gracio home"><img src="/assets/mark.svg" alt=""><span>Gracio</span></a>
  <nav aria-label="Main">{links}</nav>
</div></header>
'''


FOOT = '''<footer><div class="wrap">
  <nav aria-label="Footer"><a href="/support.html">Support</a><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a><a href="https://www.instagram.com/gracioapp">Instagram</a><a href="https://www.tiktok.com/@gracioapp">TikTok</a></nav>
  <p>© 2026 Gracio. An independent app made in Bergen County, New Jersey.</p>
  <p>Business listings from the <a href="https://overturemaps.org">Overture Maps Foundation</a>.</p>
</div></footer>
</body>
</html>
'''

for src in sorted((ROOT / 'src').glob('*.html')):
    text = src.read_text()
    title = re.search(r'<!-- title: (.*?) -->', text).group(1)
    desc = re.search(r'<!-- description: (.*?) -->', text).group(1)
    body = re.sub(r'<!-- (title|description): .*? -->\n?', '', text).replace('{{butler}}', BUTLER)
    path = '/' if src.name == 'index.html' else f'/{src.name}'
    (ROOT / src.name).write_text(head(title, desc, path) + top(path) + body + FOOT)
    print('built', src.name)
