import {useState,type FormEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {LockKeyhole,ArrowRight,Eye,EyeOff} from 'lucide-react';
import Dashboard from './dashboard';
import {unlock,lock} from './market-client';
import type {Market} from './market-core';
function App(){
 const [market,setMarket]=useState<Market|null>(null),[password,setPassword]=useState(''),[visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{setMarket(await unlock(password));setPassword('');}catch(e){setError(e instanceof Error?e.message:'网络连接失败，请重试。');}finally{setBusy(false);}}
 if(market)return <Dashboard initialMarket={market} onLock={()=>{lock();setMarket(null);setPassword('');setError('');window.scrollTo(0,0);}}/>;
 return <div className="access-page"><div className="access-brand"><span className="brand-mark">金</span><span>金汇<small>黄金 · 白银 · 欧元观察</small></span></div><main className="access-card"><div className="access-lock"><LockKeyhole size={28}/></div><div className="section-kicker">JINHUI OBSERVER</div><h1>请输入访问密码</h1><p className="access-description">输入网站主人分享的密码，查看行情走势、涨跌热力图与统计日历。</p><form onSubmit={submit}><label htmlFor="access-password">访问密码</label><div className="access-input"><input id="access-password" type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required maxLength={128} placeholder="输入访问密码" disabled={busy}/><button type="button" aria-label={visible?'隐藏密码':'显示密码'} aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={21}/>:<Eye size={21}/>}</button></div><div className="access-error" role="alert">{error}</div><button className="access-submit" disabled={busy||!password} type="submit">{busy?'正在解锁…':'进入网站'}<ArrowRight size={19}/></button></form><p className="access-help">没有密码？请联系网站主人获取。<br/>无需邮箱，无需注册账号。</p></main><p className="access-footer">金汇 · 每一个数字，都有出处。</p></div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
