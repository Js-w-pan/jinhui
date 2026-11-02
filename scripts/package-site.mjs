import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export async function packageSite(root=process.cwd()){
  const files=['index.html','app.js','style.css','favicon.svg','data/market.enc.json'];
  const missing=[];
  for(const file of files){
    const stat=await fs.stat(path.join(root,file)).catch(()=>null);
    if(!stat?.isFile()||stat.size===0)missing.push(file);
  }
  if(missing.length)throw Error('缺少或为空的网站文件：'+missing.join('、')+'。请把完整迁移包中的对应文件上传到 main 的正确位置。');
  const output=path.join(root,'_site');
  await fs.mkdir(path.join(output,'data'),{recursive:true});
  for(const file of files){
    await fs.copyFile(path.join(root,file),path.join(output,file));
    console.log('已准备：'+file);
  }
  // Generate this marker here: browser uploads can omit dotfiles or empty files.
  await fs.writeFile(path.join(output,'.nojekyll'),'');
  console.log('网站文件已准备完成；.nojekyll 已自动生成，无需手动上传。');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await packageSite();}catch(error){console.error(error.message);process.exitCode=1;}
}
