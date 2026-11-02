import {deriveKey,decryptMarket} from './encryption.mjs';
import type {Market} from './market-core';
let accessKey:CryptoKey|null=null,accessSalt:string|null=null;
async function payload(){
 const url=new URL('./data/market.enc.json',document.baseURI);url.searchParams.set('v',String(Date.now()));
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('行情文件暂时无法读取，请稍后重试。');
 return r.json();
}
function validate(m:Market){
 if(!m||!Array.isArray(m.series)||!Array.isArray(m.quotes)||!m.updatedAt)throw Error('行情数据不完整。');
 for(const id of ['sge-gold','sge-silver','ecb-eur'])if(!m.series.some(s=>s.id===id&&Array.isArray(s.points)))throw Error('行情数据不完整。');
 return m;
}
export async function unlock(password:string){
 if(!crypto.subtle)throw Error('请使用支持 HTTPS 的现代浏览器打开本网站。');
 const p=await payload(),key=await deriveKey(password,p.salt);
 let m:Market;try{m=await decryptMarket(p,key);}catch{throw Error('访问密码不正确，或行情文件不完整。');}
 validate(m);accessKey=key;accessSalt=p.salt;return m;
}
export async function loadMarket(){
 if(!accessKey)throw Error('请重新输入访问密码。');
 const p=await payload();
 if(p.salt!==accessSalt)throw Error('访问密码已变更，请退出后重新输入密码。');
 try{return validate(await decryptMarket(p,accessKey));}catch{throw Error('无法解锁新数据，请退出后重新输入密码。');}
}
export function lock(){accessKey=null;accessSalt=null;}
