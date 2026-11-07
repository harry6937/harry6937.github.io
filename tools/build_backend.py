from pathlib import Path
import json
root=Path(__file__).parent
code=(root/'apps-script/Code.gs').read_text()
bridge=(root/'apps-script/Bridge.html').read_text()
(root/'apps-script/Deploy.gs').write_text(code+'\nvar BRIDGE_HTML_ = '+json.dumps(bridge,ensure_ascii=False)+';\n')
print('Built apps-script/Deploy.gs')
