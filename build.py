"""Builds the site: wraps each page in src/ with the shared head, header and footer.

Run `python3 build.py` after editing anything in src/. Each src page starts with two lines:
  <!-- title: Page title -->
  <!-- description: One sentence for search results -->
`{{butler}}` inserts the mascot (assets/mascot.webp, with a PNG for older browsers).
"""
import pathlib, re

ROOT = pathlib.Path(__file__).parent
SITE = 'https://gracioapp.com'
# The mascot artwork (Abel's final version, Nov 19, 2026), cut out of its paper background, unchanged otherwise.
BUTLER = ('<picture><source srcset="/assets/mascot.webp" type="image/webp">'
          '<img src="/assets/mascot.png" width="640" height="899" alt="Gracio\'s mascot, a teal butler with a bow tie and a towel marked G"></picture>')
NAV = [('/', 'Home'), ('/#how', 'How it works'), ('/support.html', 'Support'), ('/privacy.html', 'Privacy')]


def head(title, desc, path, robots=None):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
{f'<meta name="robots" content="{robots}">' + chr(10) if robots else ''}<link rel="canonical" href="{SITE}{path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:type" content="website">
<meta property="og:url" content="{SITE}{path}">
<meta name="theme-color" content="#FFFCF6">
<link rel="preload" href="/assets/fonts/cormorant-sc-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/site.css">
</head>
<body>
'''


def top(path):
    """The site header: brand, page links, and the For business button. Also used, as text, by business/index.html."""
    current = ' aria-current="page"'  # kept outside the f-string so older Pythons (before 3.12) can run this
    links = ''.join(f'<a href="{h}"{current if h == path else ""}>{label}</a>' for h, label in NAV)
    return f'''<header class="top"><div class="wrap">
  <a class="brand" href="/" aria-label="Gracio home"><img src="/assets/mark.svg" alt=""><span>Gracio</span></a>
  <nav aria-label="Main">{links}<a class="nav-cta" href="/business/">For business</a></nav>
</div></header>
'''


FOOT = '''<footer><div class="wrap">
  <div class="foot-brand">
    <a class="brand" href="/" aria-label="Gracio home"><img src="/assets/mark.svg" alt=""><span>Gracio</span></a>
    <p>Service, scored. An independent app made in Bergen County, New Jersey.</p>
  </div>
  <nav aria-label="Gracio"><h2>Gracio</h2><a href="/">Home</a><a href="/#how">How it works</a><a href="/support.html">Support</a></nav>
  <nav aria-label="Business"><h2>Business</h2><a href="/business/">Claim your business</a><a href="/business/">Reply to reviews</a></nav>
  <nav aria-label="Legal"><h2>Legal</h2><a href="/privacy.html">Privacy policy</a><a href="/terms.html">Terms of use</a></nav>
  <nav aria-label="Follow"><h2>Follow</h2><a href="https://www.instagram.com/gracioapp">Instagram</a><a href="https://www.tiktok.com/@gracioapp">TikTok</a></nav>
  <div class="foot-small">
    <p>© 2026 Gracio. Business listings from the <a href="https://overturemaps.org">Overture Maps Foundation</a>.</p>
    <a class="top-link" href="#">Back to top ↑</a>
  </div>
</div></footer>
</body>
</html>
'''

for src in sorted((ROOT / 'src').glob('*.html')):
    text = src.read_text()
    title = re.search(r'<!-- title: (.*?) -->', text).group(1)
    desc = re.search(r'<!-- description: (.*?) -->', text).group(1)
    robots = re.search(r'<!-- robots: (.*?) -->', text)  # e.g. noindex for shared-collection pages
    body = re.sub(r'<!-- (title|description|robots): .*? -->\n?', '', text).replace('{{butler}}', BUTLER)
    path = '/' if src.name == 'index.html' else f'/{src.name}'
    (ROOT / src.name).write_text(head(title, desc, path, robots and robots.group(1)) + top(path) + body + FOOT)
    print('built', src.name)
