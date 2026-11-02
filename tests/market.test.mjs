import test from 'node:test';
import assert from 'node:assert/strict';
import {stats,monthlyReturns,presetRange,periodRange,cleanPoints,enrich} from '../src/market-core.ts';
import {parseBOC,parseCCB,parseABC,parseBOCOM,parseCMB,parsePSBC,parseGold,parseECB} from '../src/parsers.ts';
import fs from 'node:fs';
const raw=n=>fs.readFileSync(new URL('./fixtures/'+n,import.meta.url),'utf8');
test('calendar handles leap years, month end and weeks crossing a year',()=>{
 assert.deepEqual(presetRange('2024-03-31','1m'),['2024-02-29','2024-03-31']);
 assert.deepEqual(presetRange('2024-02-29','1y'),['2023-02-28','2024-02-29']);
 assert.deepEqual(periodRange('2025-01-01','week'),['2024-12-30','2025-01-05']);
 assert.deepEqual(periodRange('2024-02-15','month'),['2024-02-01','2024-02-29']);
});
test('returns, drawdown and single-point empty states are truthful',()=>{
 const a=[100,120,90,108].map((close,i)=>({date:`2026-01-0${i+1}`,close}));
 const s=stats(a);assert.equal(s.high,120);assert.equal(s.low,90);assert.equal(s.drawdown,-25);assert.ok(Math.abs(s.change-8)<1e-9);
 assert.equal(stats(a.slice(0,1)).change,null);assert.equal(stats([]),null);
 assert.equal(enrich(a)[0].change,null);
});
test('monthly returns need the preceding calendar month; no fabricated gap filling',()=>{
 const r=monthlyReturns([{date:'2026-01-30',close:100},{date:'2026-02-27',close:105},{date:'2026-04-30',close:110}]);
 assert.equal(r['2026-01'],null);assert.ok(Math.abs(r['2026-02']-5)<1e-9);assert.equal(r['2026-04'],null);
 assert.equal(cleanPoints([{date:'2026-01-01',close:0},{date:'2026-01-02',close:100}]).length,1);
});
test('official fixtures retain publication dates and normalize bank quote directions',()=>{
 const now='2026-10-20T14:00:00Z';
 const boc=parseBOC(raw('boc.txt'),now)[0];assert.ok(boc.buy>7&&boc.buy<8);assert.ok(boc.buy<boc.sell);
 const ccb=parseCCB(raw('ccbgold.xml'),'gold',now)[0];assert.equal(ccb.buy,886.49);assert.equal(ccb.sell,886.99);
 const ccbfx=parseCCB(raw('ccbfx.xml'),'eur',now)[0];assert.equal(ccbfx.buy,7.4775);
 for(const [file,parser] of [['abcfx.json',parseABC],['bocomfx.json',parseBOCOM],['cmbfx.json',parseCMB],['psbcfx.json',parsePSBC]]){
   const q=parser(raw(file),now)[0];assert.ok(q.buy>7&&q.buy<8,file);assert.ok(q.buy<=q.sell,file);assert.match(q.publishedAt,/^2026-10-20 /);
 }
 assert.throws(()=>parseBOC('<td>欧元</td>',now));assert.throws(()=>parseCCB('<html>error</html>','gold',now));
});
test('official histories have unique ordered positive dates and valid OHLC',()=>{
 const gold=parseGold(raw('goldHistory.txt')),eur=parseECB(raw('ecb.txt'));
 assert.ok(gold.length>2300);assert.ok(eur.length>5000);
 for(const list of [gold,eur]){assert.equal(new Set(list.map(p=>p.date)).size,list.length);assert.ok(list.every((p,i)=>p.close>0&&(!i||p.date>list[i-1].date)));}
 assert.ok(gold.every(p=>p.quality?(p.low==null&&p.high==null):(p.low<=p.close&&p.close<=p.high)));
 const anomaly=gold.find(p=>p.date==='2017-02-10');assert.equal(anomaly.close,272.83);assert.ok(anomaly.quality);
});

