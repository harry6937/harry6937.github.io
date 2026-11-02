import fs from 'node:fs/promises';
const base = new URL('../',import.meta.url);
const code = await fs.readFile(new URL('apps-script/Code.gs',base),'utf8');
const html = await fs.readFile(new URL('site/app.html',base),'utf8');
const bridge = await fs.readFile(new URL('apps-script/Bridge.html',base),'utf8');
await fs.mkdir(new URL('outputs/',base),{recursive:true});
await fs.writeFile(new URL('outputs/Deploy.gs',base), code+'\nconst BRIDGE_HTML = '+JSON.stringify(bridge)+';\n');
await fs.writeFile(new URL('index.html',base),html);
console.log('Built GitHub UI and private Apps Script bridge.');
