import fs from 'node:fs/promises';
const base = new URL('../',import.meta.url);
const code = await fs.readFile(new URL('apps-script/Code.gs',base),'utf8');
const html = await fs.readFile(new URL('site/app.html',base),'utf8');
await fs.mkdir(new URL('outputs/',base),{recursive:true});
await fs.writeFile(new URL('outputs/Deploy.gs',base), code+'\nconst APP_HTML = '+JSON.stringify(html)+';\n');
console.log('Bundled Apps Script: '+(code.length+html.length)+' characters.');
