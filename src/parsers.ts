import {cleanPoints,type Point,type Quote} from "./market-core.ts";
export const plain=(s:string)=>s.replace(/<!--[\s\S]*?-->/g,"").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();
export function tableRows(html:string){return [...html.replace(/<!--[\s\S]*?-->/g,"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(c=>plain(c[1])));}
export function numeric(v:unknown):number|null{if(typeof v!=="string"&&typeof v!=="number")return null;const t=String(v).replace(/,/g,"").trim();if(!t||t==="-"||t==="--")return null;const n=Number(t);return Number.isFinite(n)&&n>0?n:null;}
export function parseGold(text:string):Point[]{
  const obj=JSON.parse(text);if(!Array.isArray(obj.time))throw Error("上金所数据结构变化");
  const points=cleanPoints(obj.time.map((r:unknown[])=>{
    const p:Point={date:String(r[0]),open:Number(r[1]),close:Number(r[2]),low:Number(r[3]),high:Number(r[4])};
    if(!(p.low!<=p.close&&p.close<=p.high!)){p.quality="源站高低价与收盘价不一致；保留源站收盘价，高低价暂不展示";delete p.high;delete p.low;}
    return p;
  }));
  if(points.length<30)throw Error("上金所日线数据不完整");return points;
}
export function parseECB(text:string,minPoints=30):Point[]{
  const points:Point[]=[];
  for(const m of text.matchAll(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g)){
    const c=m[2].match(/currency=['"]CNY['"]\s+rate=['"]([\d.]+)['"]/);
    if(c)points.push({date:m[1],close:Number(c[1])});
  }
  if(points.length<minPoints)throw Error("欧洲央行历史数据不完整");return cleanPoints(points);
}
export function parseBOC(html:string,now:string):Quote[]{
  const row=tableRows(html).find(r=>r[0]==="欧元");
  if(!row)throw Error("中国银行欧元报价未找到");
  const buy=numeric(row[1]),sell=numeric(row[3]);
  const date=row.slice(6).join(" ").match(/\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2}/)?.[0].replaceAll("/","-");
  if(!buy||!sell||!date||buy>sell)throw Error("中国银行报价或时间校验失败");
  return [{id:"boc-eur",bank:"中国银行",asset:"eur",product:"欧元现汇",buy:buy/100,sell:sell/100,publishedAt:date,fetchedAt:now,url:"https://www.boc.cn/sourcedb/whpj/",status:"ok"}];
}
export function xmlField(block:string,key:string){return block.match(new RegExp(`<${key}[^>]*>([\\s\\S]*?)<\\/${key}>`))?.[1].trim()??"";}
export function parseCCB(text:string,asset:"gold"|"silver"|"eur",now:string):Quote[]{
  const blocks=text.split(/<ReferencePriceSettlement\b[^>]*>/).slice(1);
  const b=blocks.find(b=>asset==="eur"?xmlField(b,"Ofrd_Ccy_CcyCd")==="978":xmlField(b,"PM_Txn_Vrty_Cd")===(asset==="silver"?"21":"01")&&xmlField(b,"CcyCd")==="156");
  if(!b)throw Error("建设银行报价结构变化");
  const buy=numeric(xmlField(b,asset==="eur"?"BidRateOfCcy":"Cst_Sell_Prc"));
  const sell=numeric(xmlField(b,asset==="eur"?"OfrRateOfCcy":"Cst_Buy_Prc"));
  const rawDate=asset==="eur"?xmlField(b,"LstPr_Dt")+xmlField(b,"LstPr_Tm"):xmlField(b,"Tms");
  const digits=rawDate.replace(/\D/g,"");const publishedAt=digits.length>=14?`${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6,8)} ${digits.slice(8,10)}:${digits.slice(10,12)}:${digits.slice(12,14)}`:rawDate;
  if(!buy||!sell||buy>sell||!publishedAt)throw Error("建设银行报价校验失败");
  // CCB's official gold3v/js/fun.js maps code 21 to 人民币银, quoted in 元/克.
  // Normalize silver to 元/千克 so the dashboard and historical series share a unit.
  const scale=asset==="silver"?1000:1;
  return [{id:`ccb-${asset}`,bank:"建设银行",asset,product:asset==="eur"?"欧元现汇":asset==="silver"?"账户白银（元/克折算）":"账户黄金 AU9999",unit:asset==="eur"?"人民币 / 1 欧元":asset==="silver"?"元 / 千克":"元 / 克",buy:buy*scale,sell:sell*scale,publishedAt,fetchedAt:now,url:asset==="eur"?"https://finance3.ccb.com/chn/forex/exchange-quotations.shtml?tab=0":"http://www.ccb.com/chn/home/gold3v/scxq/jxgjsxq/index.shtml",status:"ok"}];
}
function euroQuote(id:string,bank:string,b:unknown,s:unknown,date:string,now:string,url:string,unit=100):Quote[]{
  const buy=numeric(b),sell=numeric(s);
  if(!buy||!sell||buy>sell||!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(date))throw Error(bank+"字段校验失败");
  return [{id,bank,asset:"eur",product:"欧元现汇",buy:buy/unit,sell:sell/unit,publishedAt:date,fetchedAt:now,url,status:"ok"}];
}
export function parseABC(text:string,now:string){
  const body=JSON.parse(text),r=body.Data?.Table?.find((r:Record<string,string>)=>r.CurrName==="欧元(EUR)");
  if(!r||body.ErrorCode!=="0")throw Error("农行接口未返回欧元");
  return euroQuote("abc-eur","农业银行",r.BuyingPrice,r.SellPrice,r.PublishTime.replace("T"," ").slice(0,19),now,"https://ewealth.abchina.com/ForeignExchange/ListPrice/");
}
export function parseBOCOM(text:string,now:string){
  const html=JSON.parse(text).RSP_BODY?.fileContent??"",r=tableRows(html).find(r=>r[0]?.includes("EUR/CNY"));
  if(!r||Number(r[1])!==100)throw Error("交行欧元报价未找到");
  return euroQuote("bocom-eur","交通银行",r[2],r[3],html.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0]??"",now,"https://www.bankcomm.com/SITE/queryExchangeResult.do");
}
export function parseCMB(text:string,now:string){
  const body=JSON.parse(text),r=body.body?.find((r:Record<string,string>)=>r.ccyNbr==="欧元");
  if(!r||body.returnCode!=="SUC0000")throw Error("招行欧元报价未找到");
  const d=r.ratDat.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return euroQuote("cmb-eur","招商银行",r.rthBid,r.rthOfr,d?`${d[1]}-${d[2].padStart(2,"0")}-${d[3].padStart(2,"0")} ${r.ratTim}`:"",now,"https://fx.cmbchina.com/");
}
export function parsePSBC(text:string,now:string){
  const match=text.match(/^\s*\w+\(([\s\S]*)\)\s*;?\s*$/),body=JSON.parse(match?match[1]:text);
  const r=body.resultList?.find((r:Record<string,string>)=>r.cur==="EUR"||r.cur==="978");
  if(!r||body.retCode!=="000")throw Error("邮储欧元报价未找到");
  const d=r.effect_date,t=r.effect_time;
  return euroQuote("psbc-eur","邮储银行",r.fe_buy_prc,r.fe_sell_prc,`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)} ${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}`,now,"https://www.psbc.com/");
}
