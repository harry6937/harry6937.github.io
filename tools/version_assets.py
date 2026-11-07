from pathlib import Path
import hashlib,re
root=Path(__file__).parent
page=root/'index.html'
text=page.read_text()
for name in ['style.css','seed.js','core.js','config.js','cloud.js','app.js']:
 digest=hashlib.sha256((root/name).read_bytes()).hexdigest()[:12]
 text=re.sub(r'(["\'])'+re.escape(name)+r'(?:\?v=[^"\']*)?(["\'])',lambda m:m.group(1)+name+'?v='+digest+m.group(2),text)
page.write_text(text)
print('Versioned static assets')
