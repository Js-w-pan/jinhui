import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanPoints,chinaToday} from '../src/market-core.ts';
import {parseGold,parseECB,parseBOC,parseCCB,parseABC,parseBOCOM,parseCMB,parsePSBC} from '../src/parsers.ts';
import {encryptMarket,decryptMarket,deriveKey} from '../src/encryption.mjs';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const silverTemplate={id:'sge-silver',name:'上海黄金交易所 Ag(T+D)',asset:'silver',unit:'元 / 千克',url:'https://www.sge.com.cn/sjzx/mrhq',points:[],fetchedAt:'',status:'unavailable'};
export async function request(url,body,headers={}){
 let last;
 for(let attempt=0;attempt<2;attempt++)try{
  const r=await fetch(url,{method:body?'POST':'GET',body,headers:{'User-Agent':'Mozilla/5.0',...(body?{'Content-Type':'application/x-www-form-urlencoded'}:{}),...headers},signal:AbortSignal.timeout(25000)});
  if(!r.ok)throw Error(`HTTP ${r.status}`);
  return new TextDecoder(/charset\s*=\s*(gbk|gb2312)/i.test(r.headers.get('content-type')||'')?'gb18030':'utf-8').decode(await r.arrayBuffer());
 }catch(e){last=e;}
 throw last;
}
export function mergeSeries(old,incoming,today=chinaToday()){
 const points=cleanPoints([...old.points,...incoming.points]).filter(p=>p.date<=today);
 return {...incoming,points};
}
async function ecbPoints(){
 try{return parseECB(await request('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist-90d.xml'));}
 catch{return parseECB(await request('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'),1);}
}
export function recordQuotes(market,quotes,now){
 for(const q of quotes){
  if(q.publishedAt.slice(0,10)>chinaToday())throw Error('报价发布时间在未来');
  const prev=market.quotes.find(v=>v.id===q.id);
  if(prev&&prev.publishedAt>q.publishedAt)continue;
  market.quotes=market.quotes.filter(v=>v.id!==q.id);market.quotes.push(q);
  for(const side of ['buy','sell']){
   if(q[side]==null||!/^\d{4}-\d{2}-\d{2}/.test(q.publishedAt))continue;
   const id=`${q.id}-${side}`,old=market.series.find(s=>s.id===id);
   const series={id,name:`${q.bank} · ${q.product} · 银行${side==='buy'?'买入':'卖出'}`,asset:q.asset,unit:q.unit??(q.asset==='eur'?'人民币 / 1 欧元':q.asset==='silver'?'元 / 千克':'元 / 克'),url:q.url,fetchedAt:now,status:q.status,points:[{date:q.publishedAt.slice(0,10),close:q[side]}]};
   market.series=market.series.filter(s=>s.id!==id);market.series.push(mergeSeries(old??{points:[]},series));
  }
 }
}
export async function update(old){
 const now=new Date().toISOString(),next=structuredClone(old);next.updatedAt=now;next.errors=[];next.storage=true;
 next.series.forEach(s=>s.status='cached');next.quotes.forEach(q=>q.status='cached');
 for(const q of [...next.quotes])recordQuotes(next,[q],q.fetchedAt);
 if(!next.series.some(s=>s.id===silverTemplate.id))next.series.push({...silverTemplate});
 const metals=()=>request('http://finance3.ccb.com/cn/home/news/zhgjs_new.xml');
 const jobs=[
  ['上海黄金交易所黄金',async()=>({id:'sge-gold',points:parseGold(await request('https://www.sge.com.cn/graph/Dailyhq',new URLSearchParams({instid:'Au99.99'}).toString()))})],
  ['上海黄金交易所白银',async()=>({id:'sge-silver',points:parseGold(await request('https://www.sge.com.cn/graph/Dailyhq',new URLSearchParams({instid:'Ag(T+D)'}).toString()))})],
  ['欧洲央行',async()=>({id:'ecb-eur',points:await ecbPoints()})],
  ['中国银行',async()=>({quotes:parseBOC(await request('https://www.boc.cn/sourcedb/whpj/'),now)})],
  ['建设银行外汇',async()=>({quotes:parseCCB(await request('http://finance3.ccb.com/cn/home/news/jshckpj_new2.xml'),'eur',now)})],
  ['建设银行贵金属',async()=>{const text=await metals();return {quotes:[...parseCCB(text,'gold',now),...parseCCB(text,'silver',now)]};}],
  ['农业银行',async()=>({quotes:parseABC(await request('https://ewealth.abchina.com/app/data/api/DataService/ExchangeRateV2',undefined,{'Referer':'https://ewealth.abchina.com/ForeignExchange/ListPrice/'}),now)})],
  ['交通银行',async()=>({quotes:parseBOCOM(await request('http://www.bankcomm.com/SITE/queryExchangeResult.do'),now)})],
  ['招商银行',async()=>({quotes:parseCMB(await request('https://fx.cmbchina.com/api/v1/fx/rate'),now)})],
  ['邮储银行',async()=>({quotes:parsePSBC(await request('http://s.psbc.com/portal/PsbcService/foreignexchange/curr'),now)})]
 ];
 await Promise.all(jobs.map(async([name,run])=>{try{const r=await run();if(r.id){const i=next.series.findIndex(s=>s.id===r.id);next.series[i]=mergeSeries(next.series[i],{...next.series[i],points:r.points,fetchedAt:now,status:'ok'});}if(r.quotes)recordQuotes(next,r.quotes,now);console.log(name+': OK');}catch(e){next.errors.push(name+'：'+e.message);console.log(name+': '+e.message);}}));
 return next;
}
export async function save(market,password,salt){
 const dest=path.join(root,'data/market.enc.json'),encrypted=await encryptMarket(market,password,salt);
 await fs.writeFile(dest+'.tmp',JSON.stringify(encrypted));await fs.rename(dest+'.tmp',dest);
 return encrypted;
}
async function main(){
 const password=process.env.JINHUI_PASSWORD;if(!password)throw Error('请先在仓库 Actions secrets 中配置 JINHUI_PASSWORD。不会发布未加密数据。');
 const payload=JSON.parse(await fs.readFile(path.join(root,'data/market.enc.json'),'utf8'));
 const old=await decryptMarket(payload,await deriveKey(password,payload.salt));
 const next=await update(old);await save(next,password,payload.salt);
 console.log(JSON.stringify({checkedAt:next.updatedAt,series:next.series.map(s=>({id:s.id,points:s.points.length,last:s.points.at(-1)?.date,status:s.status})),errors:next.errors}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
