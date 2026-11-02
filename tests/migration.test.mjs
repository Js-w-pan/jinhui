import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {parseGold,parseCCB,parseECB} from '../src/parsers.ts';
import {encryptMarket,decryptMarket,deriveKey} from '../src/encryption.mjs';
import {mergeSeries,recordQuotes,update} from '../scripts/update-market.mjs';
const fixture=async n=>fs.readFile(new URL('./fixtures/'+n,import.meta.url),'utf8');
test('silver history remains an independent SGE series in yuan per kilogram',async()=>{
 const s=parseGold(await fixture('silver-history.txt'));assert.ok(s.length>2300);assert.equal(s[0].close,3981);assert.equal(s.at(-1).date,'2026-11-02');assert.equal(s.at(-1).close,11894);
 const q=parseCCB(await fixture('ccbgold.xml'),'silver','2026-11-02T10:00:00Z')[0];
 assert.equal(q.asset,'silver');assert.equal(q.buy,12320);assert.equal(q.sell,12340);assert.equal(q.unit,'元 / 千克');
});
test('market requires the correct password; wrong passwords and tampered data fail',async()=>{
 const market={series:[{id:'sge-silver',points:[{date:'2026-10-30',close:12038}]}],quotes:[]};
 const p=await encryptMarket(market,'test-password-only'),key=await deriveKey('test-password-only',p.salt);
 assert.deepEqual(await decryptMarket(p,key),market);
 const wrong=await deriveKey('wrong',p.salt);await assert.rejects(()=>decryptMarket(p,wrong));
 const corrupt={...p,data:(p.data[0]==='A'?'B':'A')+p.data.slice(1)};await assert.rejects(()=>decryptMarket(corrupt,key));
 const fresh=await encryptMarket(market,'test-password-only',p.salt);assert.notEqual(fresh.iv,p.iv);assert.deepEqual(await decryptMarket(fresh,key),market);
});
test('merge retains old records, replaces revised close, rejects future observations',()=>{
 const p=mergeSeries({points:[{date:'2020-01-02',close:3},{date:'2026-10-30',close:12}]},{points:[{date:'2026-10-30',close:13},{date:'2099-01-01',close:14}]},'2026-11-02');
 assert.deepEqual(p.points,[{date:'2020-01-02',close:3},{date:'2026-10-30',close:13}]);
});
test('bank history uses publication day and refuses to overwrite a newer quote',()=>{
 const m={quotes:[],series:[]},q={id:'ccb-silver',bank:'建设银行',asset:'silver',product:'账户白银',unit:'元 / 千克',buy:12300,sell:12320,publishedAt:'2026-10-30 15:00:00',fetchedAt:'2026-11-02T10:00:00Z',status:'ok',url:'http://www.ccb.com'};
 recordQuotes(m,[q],q.fetchedAt);recordQuotes(m,[{...q,buy:12000,publishedAt:'2026-10-30 14:00:00'}],q.fetchedAt);
 assert.equal(m.series.find(s=>s.id==='ccb-silver-buy').points[0].close,12300);assert.equal(m.series[0].points[0].date,'2026-10-30');
 recordQuotes(m,[{...q,buy:12310,publishedAt:'2026-10-30 16:00:00'}],q.fetchedAt);
 assert.equal(m.series.find(s=>s.id==='ccb-silver-buy').points.length,1);assert.equal(m.quotes[0].buy,12310);
});
test('ECB daily fallback parses one authentic record without inventing missing days',()=>{
 const p=parseECB(`<Cube time="2026-10-30"><Cube currency="CNY" rate="7.9"/></Cube>`,1);assert.deepEqual(p,[{date:'2026-10-30',close:7.9}]);
 assert.throws(()=>parseECB('<html>blocked</html>',1));
});
test('all source failures preserve original histories and report cached state',async(t)=>{
 t.mock.method(globalThis,'fetch',async()=>{throw Error('test unavailable');});
 const old={series:[{id:'sge-gold',points:[{date:'2020-01-02',close:350}],status:'ok'},{id:'ecb-eur',points:[{date:'2020-01-02',close:7.8}],status:'ok'},{id:'sge-silver',points:[{date:'2020-01-02',close:4300}],status:'ok'}],quotes:[],updatedAt:'2020-01-02T10:00:00Z',errors:[]};
 const result=await update(old);assert.equal(result.errors.length,10);assert.equal(result.series[2].points[0].close,4300);assert.equal(result.series[2].status,'cached');assert.equal(old.series[2].status,'ok');
});
