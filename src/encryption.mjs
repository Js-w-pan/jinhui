// Shared by the browser and the updater. No password is stored in this module.
export const ITERATIONS=600000;
export const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const encode=bytes=>{let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s);};
export async function deriveKey(password,salt){
 const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt:decode(salt),iterations:ITERATIONS,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptMarket(market,password,salt=encode(crypto.getRandomValues(new Uint8Array(16)))){
 const key=await deriveKey(password,salt),iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify(market)));
 return {version:1,iterations:ITERATIONS,salt,iv:encode(iv),data:encode(data)};
}
export async function decryptMarket(payload,key){
 if(payload.version!==1||payload.iterations!==ITERATIONS)throw Error('数据加密版本不兼容，请刷新网页。');
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(payload.iv)},key,decode(payload.data))));
}
