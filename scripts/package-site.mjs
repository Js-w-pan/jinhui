import fs from 'node:fs/promises';
await fs.mkdir('_site/data',{recursive:true});
for(const f of ['index.html','app.js','style.css','favicon.svg','.nojekyll','data/market.enc.json'])await fs.copyFile(f,'_site/'+f);
console.log('Packaged website assets only; source and credentials are excluded.');
