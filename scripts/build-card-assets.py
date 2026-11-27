"""Bundle the mobile card renderer's transparent motifs to avoid hanging requests."""
from pathlib import Path
from PIL import Image
import json, base64, io
root = Path(__file__).resolve().parents[1]
patterns = json.loads((root / 'wave-patterns.json').read_text())
assets = {'patterns': {}, 'gradients': {}}
for dialect, files in patterns.items():
    atlas = Image.new('RGBA', (32 * len(files), 256))
    for i, name in enumerate(files):
        atlas.paste(Image.open(root / name).convert('RGBA').resize((32, 256), Image.Resampling.LANCZOS), (i * 32, 0))
    buffer = io.BytesIO()
    atlas.save(buffer, 'PNG', optimize=True)
    assets['patterns'][dialect] = {'count': len(files), 'src': 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()}
for color in ['bright', 'warm', 'soft']:
    assets['gradients'][color] = 'data:image/png;base64,' + base64.b64encode((root / ('assets/voice-gradients/' + color + '.png')).read_bytes()).decode()
(root / 'voice-card-assets.js').write_text('window.VoiceCardAssets=' + json.dumps(assets, separators=(',', ':')) + ';')
page = (root / 'save-card.html').read_text()
start = page.index('<script>window.VoiceCardAssets=')
page = page[:start] + ''.join('<script>' + (root / name).read_text() + '</script>' for name in ['voice-card-assets.js', 'voice-card.js', 'save-card.js']) + '</body></html>'
(root / 'save-card.html').write_text(page)
