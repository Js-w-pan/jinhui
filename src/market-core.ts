export type Point = {date:string; close:number; open?:number; high?:number; low?:number; quality?:string};
export type Series = {id:string; name:string; asset:"gold"|"silver"|"eur"; unit:string; url:string; points:Point[]; fetchedAt:string; status?:string};
export type Quote = {id:string; bank:string; asset:"gold"|"silver"|"eur"; product:string; unit?:string; buy:number|null; sell:number|null; price?:number|null; publishedAt:string; fetchedAt:string; url:string; status:string};
export type Market = {series:Series[]; quotes:Quote[]; updatedAt:string; errors:string[]; storage?:boolean};
export function cleanPoints(points:Point[]):Point[]{
  return [...new Map(points.filter(p=>/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(p.close)&&p.close>0).map(p=>[p.date,p])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function stats(points:Point[]){
  if(!points.length)return null;
  const prices=points.map(p=>p.close),first=prices[0],last=prices.at(-1)!;
  let peak=first,drawdown=0;
  for(const p of prices){peak=Math.max(peak,p);drawdown=Math.min(drawdown,p/peak-1);}
  const returns=prices.slice(1).map((p,i)=>Math.log(p/prices[i]));
  const mean=returns.reduce((a,b)=>a+b,0)/Math.max(returns.length,1);
  const volatility=returns.length>1?Math.sqrt(returns.reduce((s,r)=>s+(r-mean)**2,0)/(returns.length-1))*Math.sqrt(252)*100:null;
  return {first,last,change:points.length>1?(last/first-1)*100:null,high:Math.max(...prices),low:Math.min(...prices),average:prices.reduce((s,p)=>s+p,0)/prices.length,drawdown:drawdown*100,volatility,count:prices.length};
}
export function enrich(points:Point[]){
  return points.map((p,i)=>({...p,change:i?(p.close/points[i-1].close-1)*100:null,ma20:i>=19?points.slice(i-19,i+1).reduce((s,p)=>s+p.close,0)/20:null}));
}
export function monthlyReturns(points:Point[]){
  const result:Record<string,number|null>={};
  for(let i=0;i<points.length;i++){
    const key=points[i].date.slice(0,7);
    if(i===points.length-1||points[i+1].date.slice(0,7)!==key){
      const first=points.findIndex(p=>p.date.startsWith(key));
      const expected=new Date(key+"-01T12:00:00Z");expected.setUTCMonth(expected.getUTCMonth()-1);
      result[key]=first>0&&points[first-1].date.slice(0,7)===expected.toISOString().slice(0,7)?(points[i].close/points[first-1].close-1)*100:null;
    }
  }
  return result;
}
export const chinaToday=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Shanghai",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
export function shiftDate(date:string,days:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function periodRange(date:string,mode:string):[string,string]{
  const d=new Date(date+"T12:00:00Z");
  if(mode==="week"){const start=shiftDate(date,-((d.getUTCDay()+6)%7));return [start,shiftDate(start,6)];}
  if(mode==="year")return [date.slice(0,4)+"-01-01",date.slice(0,4)+"-12-31"];
  const start=date.slice(0,7)+"-01";d.setUTCMonth(d.getUTCMonth()+1,0);return [start,d.toISOString().slice(0,10)];
}
export function presetRange(today:string,range:string):[string,string]{
  const d=new Date(today+"T12:00:00Z"),day=d.getUTCDate();
  if(range==="1w")return [shiftDate(today,-6),today];
  d.setUTCDate(1);
  if(range==="1m"||range==="3m")d.setUTCMonth(d.getUTCMonth()-(range==="1m"?1:3));
  else d.setUTCFullYear(d.getUTCFullYear()-Number(range.replace("y","")));
  const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));return [d.toISOString().slice(0,10),today];
}
