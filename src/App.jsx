import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PAYMENT_TYPES,
  CURRENCIES,
  CURRENCY_SYMBOL,
  SERVICE_CATALOG,
  SERVICE_UNIT_LABELS,
  SERVICE_GROUPS,
  UNLIMITED_SEATS,
  computeServiceLineItems,
  platformSeatsSummary,
  generateDescriptionFromServices,
} from './lib/constants.js';
import {
  nowISO,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  daysBetween,
  sha256,
  validateEmail,
  computeVAT,
  round2,
} from './lib/format.js';
import { encodePortablePayload, decodePortablePayload } from './lib/portable.js';
import {
  companyService,
  clientService,
  contractService,
  paymentService,
} from './services/supabaseServices.js';
import { userService } from './services/authService.js';
import { signingService } from './services/signingService.js';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import {
  Badge,
  Skeleton,
  EmptyState,
  Modal,
  ConfirmModal,
  Field,
  inputCls,
} from './components/ui.jsx';

/* =========================================================================
   LOGIN SCREEN
   ========================================================================= */
function LoginScreen() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Password is required.'); return; }
    setBusy(true);
    try {
      await auth.login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="Logo-scios-dark.png" alt="SCIOS" className="h-14 w-auto object-contain mx-auto mb-4" />
          <div className="text-white font-display">SOS Contracts</div>
          <div className="text-slate-400 text-sm mt-1">Science of Sports — Internal Contract Management</div>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl p-8">
          <Field label="Email" required>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls(false)} placeholder="admin@scienceofsports.com" autoFocus />
          </Field>
          <Field label="Password" required>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls(false)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
          <button disabled={busy} className="w-full py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   SIDEBAR / SHELL
   ========================================================================= */
const NAV = [
  { key:'dashboard', label:'Dashboard', icon:'📊' },
  { key:'contracts', label:'Contracts', icon:'📄', children:[
    { key:'contracts:all', label:'All Contracts' },
    { key:'contracts:new', label:'New Contract' },
  ]},
  { key:'payments', label:'Payments', icon:'💳', children:[
    { key:'payments:receivables', label:'Receivables' },
    { key:'payments:history', label:'Payment History' },
  ]},
  { key:'clients', label:'Clients', icon:'🏟️' },
  { key:'reports', label:'Reports', icon:'📈', children:[
    { key:'reports:revenue', label:'Revenue Report' },
    { key:'reports:board', label:'Board Export' },
  ]},
  { key:'settings', label:'Settings', icon:'⚙️', children:[
    { key:'settings:company', label:'Company Profile' },
    { key:'settings:users', label:'Users & Roles' },
  ]},
];

function Sidebar({ route, navigate, mobileOpen, setMobileOpen }) {
  const auth = useAuth();
  const [expanded, setExpanded] = useState(() => {
    const top = route.split(':')[0];
    return { [top]: true };
  });

  const isActive = (key) => route === key || route.startsWith(key + ':');

  return (
    <React.Fragment>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden no-print" onClick={()=>setMobileOpen(false)}></div>}
      <div className={`fixed md:static z-40 top-0 left-0 h-full w-64 bg-[var(--navy-deep)] flex flex-col transition-transform no-print ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-5 py-6 border-b border-white/10 flex flex-col items-start gap-2">
          <img src="Logo-scios-dark.png" alt="SCIOS" className="h-12 w-auto object-contain" />
          <div className="text-white font-heading">SOS Contracts</div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.map(item => (
            <div key={item.key}>
              <button
                onClick={() => {
                  if (item.children) {
                    setExpanded(e => ({ ...e, [item.key]: !e[item.key] }));
                  } else {
                    navigate(item.key); setMobileOpen(false);
                  }
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${isActive(item.key) && !item.children ? 'bg-[var(--navy-mid)] text-white' : 'text-slate-300 hover:bg-[var(--navy-mid)]/60 hover:text-white'}`}
              >
                <span>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.children && <span className="text-xs opacity-60">{expanded[item.key] ? '▾' : '▸'}</span>}
              </button>
              {item.children && expanded[item.key] && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {item.children.map(child => (
                    <button
                      key={child.key}
                      onClick={() => { navigate(child.key); setMobileOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${route === child.key ? 'bg-[var(--navy-mid)] text-white' : 'text-slate-400 hover:bg-[var(--navy-mid)]/60 hover:text-white'}`}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-white text-sm font-medium truncate">{auth.user && auth.user.name}</div>
          <div className="text-slate-400 text-xs capitalize mb-3">{auth.user && auth.user.role}</div>
          <button onClick={() => auth.logout()} className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-[var(--navy-mid)]/60 hover:text-white transition">Logout</button>
        </div>
      </div>
    </React.Fragment>
  );
}

/* =========================================================================
   DASHBOARD
   ========================================================================= */
function useContractsData() {
  const [contracts, setContracts] = useState(null);
  const [clients, setClients] = useState(null);
  const reload = useCallback(async () => {
    const [c, cl] = await Promise.all([contractService.getAll(), clientService.getAll()]);
    setContracts(c); setClients(cl);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { contracts, clients, reload };
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-[var(--border)] p-5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-data text-2xl mt-1.5" style={{ color: color || '#0f172a' }}>{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function ReminderBanners({ contracts, clients }) {
  if (!contracts) return null;
  const clientMap = Object.fromEntries((clients||[]).map(c => [c.id, c]));
  const banners = [];
  const now = new Date();

  contracts.forEach(c => {
    c.payments.forEach(p => {
      if (p.status === 'pending' || p.status === 'overdue') {
        const days = daysBetween(now, p.dueDate);
        if (days < 0 && Math.abs(days) >= 30) banners.push({ type:'formal', text:`${p.description} for ${clientMap[c.clientId]?.companyName || 'client'} is ${Math.abs(days)} days overdue — formal notice required.` });
        else if (days < 0 && Math.abs(days) >= 14) banners.push({ type:'urgent', text:`${p.description} is ${Math.abs(days)} days overdue — urgent reminder due.` });
        else if (days < 0) banners.push({ type:'warn', text:`${p.description} is overdue by ${Math.abs(days)} day(s).` });
        else if (days === 0) banners.push({ type:'info', text:`${p.description} is due today.` });
        else if (days <= 7) banners.push({ type:'info', text:`${p.description} due in ${days} day(s) — friendly reminder window.` });
      }
    });
    if (c.status === 'active' && c.endDate) {
      const days = daysBetween(now, c.endDate);
      if (days >= 0 && days <= 60) banners.push({ type:'renewal', text:`${c.title} expires in ${days} days — renewal discussion recommended.` });
    }
  });

  if (!banners.length) return null;
  const styles = {
    formal: 'bg-red-50 border-red-200 text-red-700',
    urgent: 'bg-red-50 border-red-200 text-red-700',
    warn: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
    renewal: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className="space-y-2 mb-6">
      {banners.slice(0,5).map((b, i) => (
        <div key={i} className={`border rounded-lg px-4 py-2.5 text-sm ${styles[b.type]}`}>{b.text}</div>
      ))}
    </div>
  );
}

function Dashboard({ navigate }) {
  const { contracts, clients, reload } = useContractsData();
  const toast = useToast();

  if (!contracts) {
    return (
      <div className="p-6 space-y-4">
        {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const now = new Date();

  const totalActiveValue = contracts.filter(c => c.status === 'active').reduce((s,c) => s + Number(c.value||0), 0);
  const allPayments = contracts.flatMap(c => c.payments.map(p => ({ ...p, contractTitle: c.title, contractNumber: c.contractNumber, clientId: c.clientId })));
  const collectedYTD = allPayments.filter(p => p.status === 'paid' && new Date(p.paidAt).getFullYear() === now.getFullYear()).reduce((s,p) => s + Number(p.paidAmount||0), 0);
  const outstanding = allPayments.filter(p => p.status === 'pending' || p.status === 'overdue' || p.status === 'disputed').reduce((s,p) => s + Number(p.totalAmount||0), 0);
  const overdue = allPayments.filter(p => p.status === 'overdue').reduce((s,p) => s + Number(p.totalAmount||0), 0);
  const renewalCount = contracts.filter(c => c.status === 'active' && c.endDate && daysBetween(now, c.endDate) >= 0 && daysBetween(now, c.endDate) <= 60).length;

  const stages = ['draft','sent','signed','active','expired'];
  const funnel = stages.map(s => {
    const list = contracts.filter(c => c.status === s);
    return { stage: s, count: list.length, value: list.reduce((sum,c)=>sum+Number(c.value||0),0) };
  });
  const renewalDue = contracts.filter(c => c.status === 'active' && c.endDate && daysBetween(now,c.endDate) >= 0 && daysBetween(now,c.endDate) <= 60);
  funnel.splice(4, 0, { stage: 'renewal_due', count: renewalDue.length, value: renewalDue.reduce((s,c)=>s+Number(c.value||0),0) });
  const maxFunnel = Math.max(1, ...funnel.map(f => f.value));

  const months = [0,1,2].map(i => { const d = new Date(now.getFullYear(), now.getMonth()+i, 1); return d; });
  const cashFlow = months.map(m => {
    const label = m.toLocaleString('en-US', { month:'short', year:'2-digit' });
    const expected = allPayments.filter(p => { const d = new Date(p.dueDate); return d.getMonth()===m.getMonth() && d.getFullYear()===m.getFullYear(); }).reduce((s,p)=>s+Number(p.totalAmount||0),0);
    const received = allPayments.filter(p => p.status==='paid' && p.paidAt && (() => { const d = new Date(p.paidAt); return d.getMonth()===m.getMonth() && d.getFullYear()===m.getFullYear(); })()).reduce((s,p)=>s+Number(p.paidAmount||0),0);
    return { label, expected, received };
  });
  const maxCash = Math.max(1, ...cashFlow.flatMap(c => [c.expected, c.received]));

  const riskWindows = [30,60,90].map(w => {
    const list = contracts.filter(c => c.status === 'active' && c.endDate && daysBetween(now, c.endDate) >= 0 && daysBetween(now, c.endDate) <= w);
    return { window: w, count: list.length, value: list.reduce((s,c)=>s+Number(c.value||0),0) };
  });

  const clientHealth = clients.map(cl => {
    const clientContracts = contracts.filter(c => c.clientId === cl.id);
    const activeC = clientContracts.find(c => c.status === 'active');
    const overdueP = clientContracts.flatMap(c=>c.payments).some(p => p.status === 'overdue');
    const pendingP = clientContracts.flatMap(c=>c.payments).filter(p => p.status === 'pending').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];
    let health = 'green';
    if (overdueP) health = 'red';
    else if (!activeC && clientContracts.some(c => c.status === 'sent')) health = 'amber';
    return { client: cl, status: activeC ? activeC.status : (clientContracts[0] ? clientContracts[0].status : 'draft'), health, nextDue: pendingP ? pendingP.dueDate : null };
  });

  const activityFeed = contracts.flatMap(c => c.auditLog.map(a => ({ ...a, contractTitle: c.title }))).sort((a,b) => new Date(b.at) - new Date(a.at)).slice(0,10);

  const unsignedAging = contracts.filter(c => c.status === 'sent').map(c => ({ ...c, daysSince: daysBetween(c.sentAt, now) })).sort((a,b)=>b.daysSince-a.daysSince);

  const topClients = clients.map(cl => {
    const clientContracts = contracts.filter(c => c.clientId === cl.id);
    const totalValue = clientContracts.reduce((s,c)=>s+Number(c.value||0),0);
    const collected = clientContracts.flatMap(c=>c.payments).filter(p=>p.status==='paid').reduce((s,p)=>s+Number(p.paidAmount||0),0);
    const outstandingC = clientContracts.flatMap(c=>c.payments).filter(p=>p.status!=='paid').reduce((s,p)=>s+Number(p.totalAmount||0),0);
    const latestEnd = clientContracts.reduce((latest,c) => c.endDate && (!latest || new Date(c.endDate)>new Date(latest)) ? c.endDate : latest, null);
    return { client: cl, totalValue, collected, outstanding: outstandingC, endDate: latestEnd };
  }).sort((a,b)=>b.totalValue-a.totalValue);

  const exportBoardCSV = () => {
    const mrr = contracts.filter(c=>c.status==='active' && c.paymentType==='monthly').reduce((s,c)=>s+Number(c.value||0),0);
    const arr = totalActiveValue;
    const rows = [
      ['Metric','Value'],
      ['MRR', mrr.toFixed(2)],
      ['ARR', arr.toFixed(2)],
      ['YTD Revenue', collectedYTD.toFixed(2)],
      ['Outstanding', outstanding.toFixed(2)],
      ['Renewal Pipeline (60d)', renewalCount],
    ];
    const csv = rows.map(r => r.join(',')).join('\r\n');
    downloadFile('sos-board-export.csv', '﻿' + csv, 'text/csv');
    toast.push('Board export downloaded.', 'success');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="font-display">Dashboard</div>
        <button onClick={exportBoardCSV} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Board Export</button>
      </div>

      <ReminderBanners contracts={contracts} clients={clients} />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <MetricCard label="Total Active Contract Value" value={fmtMoney(totalActiveValue,'EUR')} />
        <MetricCard label="Collected YTD" value={fmtMoney(collectedYTD,'EUR')} color="#10B981" />
        <MetricCard label="Outstanding" value={fmtMoney(outstanding,'EUR')} color="#F59E0B" />
        <MetricCard label="Overdue" value={fmtMoney(overdue,'EUR')} color="#EF4444" />
        <MetricCard label="Renewals (60 days)" value={renewalCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading mb-4 text-base">Contract Pipeline Funnel</div>
          <div className="space-y-3">
            {funnel.map(f => (
              <div key={f.stage}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="capitalize text-slate-600">{f.stage.replace('_',' ')}</span>
                  <span className="font-data">{f.count} · {fmtMoney(f.value,'EUR')}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--blue-primary)] rounded-full" style={{ width: `${(f.value/maxFunnel)*100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading mb-4 text-base">Cash Flow Forecast</div>
          <div className="space-y-4">
            {cashFlow.map(c => (
              <div key={c.label}>
                <div className="text-xs text-slate-500 mb-1">{c.label}</div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs w-16 text-slate-400">Expected</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width:`${(c.expected/maxCash)*100}%` }}></div></div>
                  <span className="text-xs font-data w-16 text-right">{fmtMoney(c.expected,'EUR')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-16 text-slate-400">Received</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width:`${(c.received/maxCash)*100}%` }}></div></div>
                  <span className="text-xs font-data w-16 text-right">{fmtMoney(c.received,'EUR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading mb-4 text-base">Renewal Risk Radar</div>
          <div className="space-y-3">
            {riskWindows.map(r => (
              <div key={r.window} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <div className="text-sm font-medium">{r.window} days</div>
                  <div className="text-xs text-slate-500">{r.count} contract(s)</div>
                </div>
                <div className="font-data text-sm">{fmtMoney(r.value,'EUR')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading mb-4 text-base">Client Health</div>
          {clientHealth.length === 0 ? <EmptyState title="No clients yet" ctaLabel="Add a client" onCta={()=>navigate('clients')} /> : (
            <div className="space-y-2">
              {clientHealth.map(h => (
                <div key={h.client.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${h.health==='green'?'bg-emerald-500':h.health==='amber'?'bg-amber-400':'bg-red-500'}`}></span>
                    <div>
                      <div className="text-sm font-medium">{h.client.companyName}</div>
                      <div className="text-xs text-slate-400">Next due: {h.nextDue ? fmtDate(h.nextDue) : '—'}</div>
                    </div>
                  </div>
                  <Badge status={h.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading mb-4 text-base">Recent Activity</div>
          {activityFeed.length === 0 ? <EmptyState title="No activity yet" icon="🕓" /> : (
            <div className="space-y-3">
              {activityFeed.map(a => (
                <div key={a.id} className="text-sm">
                  <div className="text-slate-700">{a.message}</div>
                  <div className="text-xs text-slate-400">{a.contractTitle} · {fmtDateTime(a.at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-5 mb-6">
        <div className="font-heading mb-4 text-base">Unsigned Contracts Aging</div>
        {unsignedAging.length === 0 ? <EmptyState title="Nothing pending signature" icon="✅" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-2 pr-4">Contract</th><th className="py-2 pr-4">Client</th><th className="py-2 pr-4">Sent</th><th className="py-2 pr-4">Days Since</th></tr></thead>
              <tbody>
                {unsignedAging.map(c => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-slate-50" onClick={()=>navigate('contract:'+c.id)}>
                    <td className="py-2.5 pr-4">{c.title}</td>
                    <td className="py-2.5 pr-4">{clientMap[c.clientId]?.companyName}</td>
                    <td className="py-2.5 pr-4">{fmtDate(c.sentAt)}</td>
                    <td className={`py-2.5 pr-4 font-data ${c.daysSince>14?'text-red-600':c.daysSince>7?'text-amber-600':'text-slate-600'}`}>{c.daysSince}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-5">
        <div className="font-heading mb-4 text-base">Top Clients by Value</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-2 pr-4">Client</th><th className="py-2 pr-4">Total Value</th><th className="py-2 pr-4">Collected</th><th className="py-2 pr-4">Outstanding</th><th className="py-2 pr-4">End Date</th></tr></thead>
            <tbody>
              {topClients.map(t => (
                <tr key={t.client.id} className="border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-slate-50" onClick={()=>navigate('client:'+t.client.id)}>
                  <td className="py-2.5 pr-4">{t.client.companyName}</td>
                  <td className="py-2.5 pr-4 font-data">{fmtMoney(t.totalValue,'EUR')}</td>
                  <td className="py-2.5 pr-4 font-data text-emerald-600">{fmtMoney(t.collected,'EUR')}</td>
                  <td className="py-2.5 pr-4 font-data text-amber-600">{fmtMoney(t.outstanding,'EUR')}</td>
                  <td className="py-2.5 pr-4">{t.endDate ? fmtDate(t.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =========================================================================
   CONTRACTS LIST + FORM + DETAIL
   ========================================================================= */
function ContractsList({ navigate, filterStatus }) {
  const { contracts, clients } = useContractsData();
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(filterStatus || 'all');

  if (!contracts) return <div className="p-6 space-y-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-14 w-full" />)}</div>;
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  const filtered = contracts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    const client = clientMap[c.clientId];
    const q = search.toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.contractNumber.toLowerCase().includes(q) || (client && client.companyName.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="font-display">Contracts</div>
        {auth.isAdmin && <button onClick={()=>navigate('contracts:new')} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ New Contract</button>}
      </div>
      <div className="flex flex-wrap gap-3 mb-4">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contracts…" className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg flex-1 min-w-[200px]" />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg">
          <option value="all">All statuses</option>
          {['draft','sent','signed','active','expired','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No contracts found" subtitle="Create your first contract to get started." ctaLabel={auth.isAdmin ? "New Contract" : null} onCta={()=>navigate('contracts:new')} />
      ) : (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-3 px-4">Number</th><th className="py-3 px-4">Title</th><th className="py-3 px-4">Client</th><th className="py-3 px-4">Value</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">End Date</th></tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0 cursor-pointer hover:bg-slate-50" onClick={()=>navigate('contract:'+c.id)}>
                  <td className="py-3 px-4 font-data text-xs text-slate-500">{c.contractNumber}</td>
                  <td className="py-3 px-4">{c.title}</td>
                  <td className="py-3 px-4">{clientMap[c.clientId]?.companyName || '—'}</td>
                  <td className="py-3 px-4 font-data">{fmtMoney(c.value, c.currency)}</td>
                  <td className="py-3 px-4"><Badge status={c.status} /></td>
                  <td className="py-3 px-4">{c.endDate ? fmtDate(c.endDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function defaultServicesState() {
  return Object.fromEntries(SERVICE_CATALOG.map(s => [s.key, { selected:false, qty:s.defaultQty, rate:s.defaultRate, complimentary:false, bundledIncluded:false, ...(s.key === 'platform_access' ? { directorSeats:0, coachSeats:0, playerSeats:0 } : {}) }]));
}

function ContractForm({ navigate, editContractId }) {
  const auth = useAuth();
  const toast = useToast();
  const isEdit = !!editContractId;
  const [clients, setClients] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [services, setServices] = useState(defaultServicesState);
  const [form, setForm] = useState({
    title:'', clientId:'', type:'platform_subscription', value:'', currency:'EUR',
    startDate:'', endDate:'', paymentType:'one_time', paymentTermsDays:30, latePaymentPenalty:1.5,
    governingLaw:'Republic of Cyprus', jurisdiction:'Nicosia, Cyprus', description:'', slaHours:24, specialTerms:'',
  });
  const [titleEdited, setTitleEdited] = useState(isEdit);
  const [installments, setInstallments] = useState([]);
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { clientService.getAll().then(setClients); }, []);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const existing = await contractService.getById(editContractId);
      if (!existing) { toast.push('Contract not found.', 'error'); navigate('contracts:all'); return; }
      if (existing.status !== 'draft') { toast.push('Only draft contracts can be edited.', 'error'); navigate('contract:'+existing.id); return; }
      setForm({
        title: existing.title, clientId: existing.clientId, type: existing.type,
        value: String(existing.value), currency: existing.currency,
        startDate: existing.startDate ? existing.startDate.slice(0,10) : '',
        endDate: existing.endDate ? existing.endDate.slice(0,10) : '',
        paymentType: existing.paymentType, paymentTermsDays: existing.paymentTermsDays,
        latePaymentPenalty: existing.latePaymentPenalty, governingLaw: existing.governingLaw,
        jurisdiction: existing.jurisdiction, description: existing.description, slaHours: existing.slaHours || 24,
        specialTerms: existing.specialTerms || '',
      });
      setServices(existing.services ? { ...defaultServicesState(), ...existing.services } : defaultServicesState());
      if (existing.payments && existing.payments.length) {
        if (existing.paymentType === 'one_time') {
          setOneTimeDate(existing.payments[0].dueDate.slice(0,10));
        } else if (existing.paymentType === 'milestone') {
          setInstallments(existing.payments.map(p => ({ date: p.dueDate.slice(0,10), amount: String(p.amount) })));
        } else {
          setFirstDueDate(existing.payments[0].dueDate.slice(0,10));
        }
      }
      setLoadingExisting(false);
    })();
  }, [isEdit, editContractId]);

  const RECURRING_MONTHS = { monthly: 1, quarterly: 3, annually: 12 };

  const recurringCount = () => {
    if (!RECURRING_MONTHS[form.paymentType] || !form.startDate || !form.endDate) return 0;
    const months = Math.max(1, Math.round(daysBetween(form.startDate, form.endDate) / 30.44));
    return Math.max(1, Math.round(months / RECURRING_MONTHS[form.paymentType]));
  };

  const recurringInstallments = () => {
    const count = recurringCount();
    if (!count || !firstDueDate) return [];
    const total = Number(form.value) || 0;
    const each = round2(total / count);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(firstDueDate);
      d.setMonth(d.getMonth() + i * RECURRING_MONTHS[form.paymentType]);
      const amount = i === count - 1 ? round2(total - each * (count - 1)) : each;
      return { date: d.toISOString().slice(0,10), amount };
    });
  };

  const addInstallmentRow = () => {
    setInstallments(rows => [...rows, { date: '', amount: '' }]);
  };
  const updateInstallmentRow = (i, patch) => {
    setInstallments(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const removeInstallmentRow = (i) => {
    setInstallments(rows => rows.filter((_, idx) => idx !== i));
  };
  const milestoneTotal = installments.reduce((s,r) => s + (Number(r.amount) || 0), 0);

  const generateTitle = (clientId, services) => {
    const clientName = clients?.find(c => c.id === clientId)?.companyName;
    if (!clientName) return '';
    const items = computeServiceLineItems(services);
    if (!items.length) return `${clientName} — Service Agreement`;
    const groups = SERVICE_GROUPS;
    const groupsUsed = groups.filter(g => items.some(i => i.group === g));
    if (items.some(i => i.key === 'platform_access')) return `${clientName} — Performance Analysis Agreement`;
    if (groupsUsed.length === 1 && items.length === 1) return `${clientName} — ${items[0].label}`;
    return `${clientName} — Service Agreement`;
  };

  const set = (k,v) => {
    if (k === 'title') setTitleEdited(true);
    setForm(f => ({ ...f, [k]: v }));
  };

  const setClient = (clientId) => {
    setForm(f => ({
      ...f,
      clientId,
      title: titleEdited ? f.title : generateTitle(clientId, services),
    }));
  };

  const toggleService = (key, patch) => {
    setServices(s => {
      const next = { ...s, [key]: { ...s[key], ...patch } };
      setForm(f => ({
        ...f,
        value: String(computeServiceLineItems(next).reduce((sum,i)=>sum+i.amount,0)),
        description: generateDescriptionFromServices(next, f.slaHours),
        title: titleEdited ? f.title : generateTitle(f.clientId, next),
      }));
      return next;
    });
  };

  const setSlaHours = (hours) => {
    setForm(f => ({ ...f, slaHours: hours, description: generateDescriptionFromServices(services, hours) }));
  };

  const lineItems = computeServiceLineItems(services);
  const lineItemsTotal = lineItems.reduce((s,i)=>s+i.amount,0);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (!form.clientId) e.clientId = 'Select a client.';
    if (!form.value || Number(form.value) <= 0) e.value = 'Enter a positive value.';
    if (!/^\d+(\.\d{1,2})?$/.test(String(form.value))) e.value = 'Max 2 decimal places.';
    if (form.startDate && form.endDate && new Date(form.endDate) <= new Date(form.startDate)) e.endDate = 'End date must be after start date.';
    if (form.paymentType === 'one_time' && !oneTimeDate) e.oneTimeDate = 'Payment date is required.';
    if (RECURRING_MONTHS[form.paymentType] && !firstDueDate) e.firstDueDate = 'First due date is required.';
    if (form.paymentType === 'milestone') {
      if (!installments.length) e.installments = 'Add at least one installment.';
      else if (installments.some(r => !r.date || !r.amount || Number(r.amount) <= 0)) e.installments = 'Every installment needs a date and a positive amount.';
      else if (Math.abs(milestoneTotal - Number(form.value)) > 0.01) e.installments = `Installments must add up to the contract value (${fmtMoney(form.value, form.currency)}).`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (asDraft) => {
    if (!validate()) return;
    setBusy(true);
    try {
      const client = clients.find(c => c.id === form.clientId);
      const schedule = form.paymentType === 'one_time'
        ? [{ date: oneTimeDate, amount: Number(form.value) }]
        : form.paymentType === 'milestone'
        ? installments.map(r => ({ date: r.date, amount: Number(r.amount) }))
        : recurringInstallments();

      let contract;
      if (isEdit) {
        contract = await contractService.update(editContractId, {
          ...form,
          value: Number(form.value),
          startDate: form.startDate ? new Date(form.startDate).toISOString() : '',
          endDate: form.endDate ? new Date(form.endDate).toISOString() : '',
          services,
        });
        await paymentService.replaceAllForContract(editContractId, schedule.map(inst => {
          const vat = computeVAT(client, inst.amount);
          return {
            description: `${contract.title} — payment due ${fmtDate(inst.date)}`,
            dueDate: new Date(inst.date).toISOString(),
            amount: inst.amount, vatRate: vat.vatRate, vatAmount: vat.vatAmount,
            totalAmount: round2(inst.amount + vat.vatAmount), currency: form.currency,
          };
        }));
        toast.push('Contract updated.', 'success');
      } else {
        contract = await contractService.create({
          ...form,
          value: Number(form.value),
          status: 'draft',
          startDate: form.startDate ? new Date(form.startDate).toISOString() : '',
          endDate: form.endDate ? new Date(form.endDate).toISOString() : '',
          services,
          createdBy: auth.user.id,
        });
        for (const inst of schedule) {
          const vat = computeVAT(client, inst.amount);
          await paymentService.create(contract.id, {
            description: `${contract.title} — payment due ${fmtDate(inst.date)}`,
            dueDate: new Date(inst.date).toISOString(),
            amount: inst.amount, vatRate: vat.vatRate, vatAmount: vat.vatAmount,
            totalAmount: round2(inst.amount + vat.vatAmount), currency: form.currency,
          });
        }
        toast.push('Contract created.', 'success');
      }
      navigate('contract:'+contract.id);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!clients || loadingExisting) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="font-display mb-6">{isEdit ? 'Edit Contract' : 'New Contract'}</div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-6">
        <Field label="Title" required error={errors.title}>
          <input value={form.title} onChange={e=>set('title',e.target.value)} className={inputCls(errors.title)} placeholder="e.g. Platform Access — Client Name" />
        </Field>
        <Field label="Client" required error={errors.clientId}>
          <select value={form.clientId} onChange={e=>setClient(e.target.value)} className={inputCls(errors.clientId)}>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </select>
        </Field>

        <div className="font-heading text-base mt-6 mb-1 pt-6 border-t border-[var(--border)]">Services Included</div>
        <p className="text-xs text-slate-500 mb-4">Tick each service this client is getting, set quantity and price. Mark a service "Included" to bundle it into the core platform price (shown to the client as part of the value they're getting), or "Comp" to waive it as a one-off free favor. Prices here are for your reference only — the contract sent to the client lists services and the total, not per-line prices. The description and value below update automatically — review both before saving.</p>
        {SERVICE_GROUPS.map(group => (
          <div key={group} className="mb-4 last:mb-0">
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{group}</div>
            <div className="space-y-2">
              {SERVICE_CATALOG.filter(s => s.group === group).map(s => {
                const svc = services[s.key];
                return (
                  <div key={s.key} className="py-1.5 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={svc.selected} onChange={e=>toggleService(s.key, { selected: e.target.checked })} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm">{s.label}</div>
                        <div className="text-xs text-slate-400">{SERVICE_UNIT_LABELS[s.unit]}</div>
                      </div>
                      {(s.unit === 'per_match' || s.unit === 'per_unit') && svc.selected && (
                        <input type="number" min="0" value={svc.qty} onChange={e=>toggleService(s.key, { qty: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm border border-[var(--border)] rounded-lg" placeholder="Qty" />
                      )}
                      {svc.selected && s.unit !== 'included' && (
                        <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0 cursor-pointer">
                          <input type="checkbox" checked={svc.bundledIncluded} onChange={e=>toggleService(s.key, { bundledIncluded: e.target.checked, complimentary: e.target.checked ? false : svc.complimentary })} />
                          Included
                        </label>
                      )}
                      {svc.selected && s.unit !== 'included' && (
                        <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0 cursor-pointer">
                          <input type="checkbox" checked={svc.complimentary} onChange={e=>toggleService(s.key, { complimentary: e.target.checked, bundledIncluded: e.target.checked ? false : svc.bundledIncluded })} />
                          Comp
                        </label>
                      )}
                      {svc.selected && s.unit !== 'included' && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-slate-400">{CURRENCY_SYMBOL[form.currency]}</span>
                          <input disabled={svc.complimentary || svc.bundledIncluded} type="number" min="0" step="0.01" value={svc.rate} onChange={e=>toggleService(s.key, { rate: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm border border-[var(--border)] rounded-lg text-right disabled:bg-slate-100 disabled:text-slate-400" placeholder="Rate" />
                        </div>
                      )}
                      {svc.selected && s.unit !== 'included' && (
                        <div className="w-24 text-right text-sm font-data">{(svc.complimentary || svc.bundledIncluded) ? 'Included' : fmtMoney(s.unit==='flat'?svc.rate:svc.rate*svc.qty, form.currency)}</div>
                      )}
                    </div>
                    {s.key === 'platform_access' && svc.selected && (
                      <div className="flex flex-wrap items-center gap-5 mt-2 ml-7 pl-2 border-l-2 border-slate-100">
                        {[
                          { field:'directorSeats', label:'Directors' },
                          { field:'coachSeats', label:'Coaches' },
                          { field:'playerSeats', label:'Players' },
                        ].map(({ field, label }) => {
                          const isUnlimited = svc[field] === UNLIMITED_SEATS;
                          return (
                            <div key={field} className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-xs text-slate-500">
                                {label}
                                <input
                                  type="number" min="0" disabled={isUnlimited}
                                  value={isUnlimited ? '' : svc[field]}
                                  onChange={e=>toggleService(s.key, { [field]: Number(e.target.value) })}
                                  className="w-16 px-2 py-1 text-sm border border-[var(--border)] rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                                  placeholder={isUnlimited ? '∞' : ''}
                                />
                              </label>
                              <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer">
                                <input
                                  type="checkbox" checked={isUnlimited}
                                  onChange={e=>toggleService(s.key, { [field]: e.target.checked ? UNLIMITED_SEATS : 0 })}
                                />
                                Unlimited
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {group === 'Core Services' && (
              <div className="mt-3">
                <Field label="Match Analysis SLA">
                  <select value={form.slaHours} onChange={e=>setSlaHours(Number(e.target.value))} className={inputCls(false)}>
                    {[24,48,72].map(h => <option key={h} value={h}>{h} hours</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-between pt-3 border-t border-[var(--border)] font-heading text-base">
          <span>Total</span>
          <span className="font-data">{fmtMoney(lineItemsTotal, form.currency)}</span>
        </div>

        <div className="font-heading text-base mt-6 mb-4 pt-6 border-t border-[var(--border)]">Contract Details</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Value" required error={errors.value}>
            <input disabled type="number" step="0.01" value={form.value} onChange={e=>set('value',e.target.value)} className={inputCls(errors.value)} placeholder="12000.00" />
          </Field>
          <Field label="Currency">
            <select value={form.currency} onChange={e=>set('currency',e.target.value)} className={inputCls(false)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <p className="text-xs text-slate-400 -mt-3 mb-4">Value is computed automatically from the services above.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Start Date">
            <input type="date" value={form.startDate} onChange={e=>set('startDate',e.target.value)} className={inputCls(false)} />
          </Field>
          <Field label="End Date" error={errors.endDate}>
            <input type="date" value={form.endDate} onChange={e=>set('endDate',e.target.value)} className={inputCls(errors.endDate)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Payment Type">
            <select value={form.paymentType} onChange={e=>set('paymentType',e.target.value)} className={inputCls(false)}>
              {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Payment Terms (days)">
            <select value={form.paymentTermsDays} onChange={e=>set('paymentTermsDays',Number(e.target.value))} className={inputCls(false)}>
              {[15,30,45].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </Field>
        </div>

        <div className="font-heading text-sm mb-2">Payment Schedule</div>
        {form.paymentType === 'one_time' && (
          <Field label="Payment Date" required error={errors.oneTimeDate}>
            <input type="date" value={oneTimeDate} onChange={e=>setOneTimeDate(e.target.value)} className={inputCls(errors.oneTimeDate)} />
          </Field>
        )}
        {RECURRING_MONTHS[form.paymentType] && (
          <React.Fragment>
            <Field label="First Due Date" required error={errors.firstDueDate}>
              <input type="date" value={firstDueDate} onChange={e=>setFirstDueDate(e.target.value)} className={inputCls(errors.firstDueDate)} />
            </Field>
            <p className="text-xs text-slate-500 mb-4">
              {firstDueDate && recurringCount() > 0
                ? `${recurringCount()} ${form.paymentType} payment${recurringCount()>1?'s':''} of ${fmtMoney(Number(form.value)/recurringCount(), form.currency)} each, starting ${fmtDate(firstDueDate)}.`
                : 'Set the Start/End Date above and a first due date to generate the payment dates.'}
            </p>
          </React.Fragment>
        )}
        {form.paymentType === 'milestone' && (
          <div className="mb-4">
            {errors.installments && <p className="text-xs text-red-500 mb-2">{errors.installments}</p>}
            <div className="space-y-2 mb-2">
              {installments.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="date" value={row.date} onChange={e=>updateInstallmentRow(i, { date: e.target.value })} className="px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg flex-1" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400">{CURRENCY_SYMBOL[form.currency]}</span>
                    <input type="number" min="0" step="0.01" value={row.amount} onChange={e=>updateInstallmentRow(i, { amount: e.target.value })} className="w-28 px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg text-right" placeholder="Amount" />
                  </div>
                  <button onClick={()=>removeInstallmentRow(i)} className="text-slate-400 hover:text-red-500 px-2">✕</button>
                </div>
              ))}
            </div>
            <button onClick={addInstallmentRow} className="text-sm text-[var(--blue-primary)] hover:underline">+ Add Installment</button>
            <p className="text-xs text-slate-500 mt-2">Total: {fmtMoney(milestoneTotal, form.currency)} of {fmtMoney(form.value, form.currency)}</p>
          </div>
        )}

        <Field label="Description">
          <textarea value={form.description} onChange={e=>set('description',e.target.value)} rows={18} className={inputCls(false) + ' font-data text-xs'} placeholder="Scope of work, deliverables, terms…" />
        </Field>

        <Field label="Special Terms / Additional Agreements (optional)">
          <textarea value={form.specialTerms} onChange={e=>set('specialTerms',e.target.value)} rows={4} className={inputCls(false)} placeholder="Any one-off terms specific to this club — e.g. a complimentary extra, an early-renewal discount, a custom condition. Appears as its own clause in the signed contract." />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={()=>navigate('contracts:all')} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
          <button disabled={busy} onClick={()=>submit(true)} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700 transition disabled:opacity-50">{busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save as Draft')}</button>
        </div>
      </div>
    </div>
  );
}

function ContractDetail({ contractId, navigate }) {
  const auth = useAuth();
  const toast = useToast();
  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMarkPaidPayment, setShowMarkPaidPayment] = useState(null);
  const [showMarkSignedModal, setShowMarkSignedModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [portableLink, setPortableLink] = useState(null);
  const [portableLinkError, setPortableLinkError] = useState('');

  const load = useCallback(async () => {
    const c = await contractService.getById(contractId);
    setContract(c);
    if (c) setClient(await clientService.getById(c.clientId));
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!contract || !client || contract.status !== 'sent') { setPortableLink(null); return; }
    (async () => {
      try {
        setPortableLinkError('');
        const company = await companyService.get();
        const payload = await encodePortablePayload({ contract, client, company });
        const link = `${location.origin}${location.pathname}?sign=${payload}`;
        if (link.length > 7500) {
          setPortableLinkError(`This link is very long (${link.length.toLocaleString()} characters) — some email clients or messaging apps may truncate it. Consider trimming the description or special terms, or send it as a plain text file instead of pasting inline.`);
        }
        setPortableLink(link);
      } catch (err) {
        setPortableLinkError('Could not generate a portable signing link: ' + err.message);
      }
    })();
  }, [contract, client]);

  if (!contract) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const sendContract = async () => {
    // PRIMARY send path: create a server-backed signing request. The Edge
    // Function freezes a document snapshot, sets the contract status to 'sent',
    // and emails the client a real ?req= signing link. The portable ?sign= link
    // (rendered below once status is 'sent') remains as a secondary fallback.
    setShowSendModal(false);
    try {
      const origin = window.location.origin;
      await signingService.createSigningRequest(contract.id, origin);
      toast.push(`Signing request sent to ${client.contactEmail}.`, 'success');
      load(); // contract is now status 'sent'
    } catch (err) {
      toast.push(err.message || 'Could not send the signing request.', 'error');
    }
  };

  const deleteContract = async () => {
    await contractService.delete(contract.id);
    toast.push('Contract deleted.', 'success');
    navigate('contracts:all');
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <button onClick={()=>navigate('contracts:all')} className="text-sm text-slate-500 hover:text-slate-700 mb-4">← All Contracts</button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="font-display">{contract.title}</div>
          <div className="text-sm text-slate-400 font-data mt-1">{contract.contractNumber} · v{contract.version}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={contract.status} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 no-print">
        <button onClick={()=>navigate('document:'+contract.id)} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">View Contract Document</button>
        {auth.isAdmin && contract.status === 'draft' && <button onClick={()=>navigate('contracts:edit:'+contract.id)} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">Edit</button>}
        {auth.isAdmin && contract.status === 'draft' && <button onClick={()=>setShowSendModal(true)} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Send for Signature</button>}
        {auth.isAdmin && (contract.status === 'draft' || contract.status === 'sent') && <button onClick={()=>setShowMarkSignedModal(true)} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">Record as Signed Manually</button>}
        {auth.isAdmin && contract.status === 'sent' && <button onClick={()=>setShowImportModal(true)} className="px-4 py-2 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-50 transition">Import Signed Confirmation</button>}
        {auth.isAdmin && (contract.status === 'signed' || contract.status === 'active') && <button onClick={()=>setShowPaymentModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">+ Add Payment Milestone</button>}
        {auth.isAdmin && (contract.status === 'draft' || contract.status === 'sent') && <button onClick={()=>setShowDeleteModal(true)} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">Delete</button>}
      </div>

      {auth.isAdmin && contract.status === 'sent' && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-5 mb-6 no-print">
          <div className="font-heading text-base mb-1">Signing Link</div>
          <p className="text-xs text-slate-500 mb-3">This link carries the contract data with it, so it works for the client on their own device — not just this browser. Send it via email or WhatsApp. After they sign, they'll download a confirmation file to send back to you — use "Import Signed Confirmation" above once you have it.</p>
          {portableLink ? (
            <div className="flex items-start gap-2">
              <code className="flex-1 text-xs text-blue-600 break-all bg-slate-50 rounded-lg p-2 border border-[var(--border)]">{portableLink}</code>
              <button onClick={async ()=>{ try { await navigator.clipboard.writeText(portableLink); toast.push('Signing link copied.', 'success'); } catch (e) { toast.push('Could not copy — select and copy manually.', 'error'); } }} className="px-3 py-2 text-xs border border-[var(--border)] rounded-lg hover:bg-slate-50 shrink-0">Copy</button>
            </div>
          ) : (
            <div className="text-xs text-slate-400">Generating link…</div>
          )}
          {portableLinkError && <p className="text-xs text-amber-600 mt-2">{portableLinkError}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading text-base mb-3">Contract Details</div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-slate-500">Client</dt><dd className="font-medium">{client?.companyName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Type</dt><dd className="capitalize">{contract.type.replace('_',' ')}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Value</dt><dd className="font-data">{fmtMoney(contract.value, contract.currency)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Payment Terms</dt><dd className="capitalize">{contract.paymentType.replace('_',' ')} · Net {contract.paymentTermsDays}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Start</dt><dd>{fmtDate(contract.startDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">End</dt><dd>{fmtDate(contract.endDate)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Governing Law</dt><dd>{contract.governingLaw}</dd></div>
          </dl>
          {contract.description && <p className="text-sm text-slate-600 mt-4 pt-4 border-t border-[var(--border)]">{contract.description}</p>}
        </div>

        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading text-base mb-3">Signature Status</div>
          {contract.signedAt ? (
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-slate-500">Signed by</dt><dd className="font-medium">{contract.signerName}</dd></div>
              {contract.signerTitle && <div className="flex justify-between"><dt className="text-slate-500">Title</dt><dd>{contract.signerTitle}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">Signed at</dt><dd>{fmtDateTime(contract.signedAt)}</dd></div>
              {contract.signerIP ? (
                <React.Fragment>
                  <div className="flex justify-between"><dt className="text-slate-500">IP Address</dt><dd className="font-data text-xs">{contract.signerIP}</dd></div>
                  <div className="flex justify-between"><dt className="text-slate-500">Document Integrity</dt><dd className="text-emerald-600">{contract.documentHashBefore === contract.documentHashAfter ? '✓ Verified' : '⚠ Mismatch'}</dd></div>
                </React.Fragment>
              ) : (
                <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="text-slate-500 text-xs">Recorded manually (paper/offline signature)</dd></div>
              )}
            </div>
          ) : (
            <EmptyState title={contract.status==='sent' ? 'Awaiting signature' : 'Not yet sent'} subtitle={contract.status==='sent' ? 'The client has not signed this contract yet.' : 'Send this contract to collect a signature.'} icon="✍️" />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-5 mb-6">
        <div className="font-heading text-base mb-3">Signed Document</div>
        <ContractAttachment contract={contract} onChange={load} />
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-5 mb-6">
        <div className="font-heading text-base mb-3">Payment Milestones</div>
        {contract.payments.length === 0 ? <EmptyState title="No payment milestones yet" icon="💳" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-2 pr-4">QB Invoice #</th><th className="py-2 pr-4">Description</th><th className="py-2 pr-4">Due</th><th className="py-2 pr-4">Total</th><th className="py-2 pr-4">Status</th><th className="py-2 pr-4"></th></tr></thead>
              <tbody>
                {contract.payments.map(p => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 font-data text-xs">{p.accountingRef || '—'}</td>
                    <td className="py-2.5 pr-4">{p.description}</td>
                    <td className="py-2.5 pr-4">{fmtDate(p.dueDate)}</td>
                    <td className="py-2.5 pr-4 font-data">{fmtMoney(p.totalAmount, p.currency)}</td>
                    <td className="py-2.5 pr-4"><Badge status={p.status} /></td>
                    <td className="py-2.5 pr-4 no-print space-x-2">
                      {auth.isAdmin && p.status !== 'paid' && <button onClick={()=>setShowMarkPaidPayment(p)} className="text-emerald-600 hover:underline text-xs">Mark Paid</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[var(--border)] p-5">
        <div className="font-heading text-base mb-3">Audit Log</div>
        <div className="space-y-3">
          {contract.auditLog.slice().reverse().map(a => (
            <div key={a.id} className="text-sm border-b border-[var(--border)] last:border-0 pb-3 last:pb-0">
              <div className="text-slate-700">{a.message}</div>
              <div className="text-xs text-slate-400">{fmtDateTime(a.at)}</div>
            </div>
          ))}
        </div>
      </div>

      <ConfirmModal open={showSendModal} onClose={()=>setShowSendModal(false)} onConfirm={sendContract} title="Send for Signature" message={`This will send "${contract.title}" to ${client?.contactName} (${client?.contactEmail}) for electronic signature. Continue?`} confirmLabel="Send" />
      <ConfirmModal open={showDeleteModal} onClose={()=>setShowDeleteModal(false)} onConfirm={deleteContract} title="Delete Contract" message="This will permanently delete this contract. It has not been signed yet, but this cannot be undone." confirmLabel="Delete" danger />
      {showPaymentModal && <AddPaymentModal contract={contract} client={client} onClose={()=>setShowPaymentModal(false)} onDone={()=>{ setShowPaymentModal(false); load(); }} />}
      {showMarkPaidPayment && <MarkPaidModal contract={contract} payment={showMarkPaidPayment} onClose={()=>setShowMarkPaidPayment(null)} onDone={()=>{ setShowMarkPaidPayment(null); load(); }} />}
      {showMarkSignedModal && <MarkSignedManuallyModal contract={contract} client={client} onClose={()=>setShowMarkSignedModal(false)} onDone={()=>{ setShowMarkSignedModal(false); load(); }} />}
      {showImportModal && <ImportSignedConfirmationModal contract={contract} client={client} onClose={()=>setShowImportModal(false)} onDone={()=>{ setShowImportModal(false); load(); }} />}
    </div>
  );
}

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_LOGO_BYTES = 1 * 1024 * 1024;

function ContractAttachment({ contract, onChange }) {
  const auth = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const fileInputRef = useRef(null);

  const onFilePicked = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.push('Only PDF files are supported.', 'error');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.push(`File is too large (${(file.size/1024/1024).toFixed(1)}MB). Maximum is 3MB.`, 'error');
      return;
    }
    setBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.readAsDataURL(file);
      });
      await contractService.setAttachment(contract.id, base64, file.name);
      await contractService.addAuditEntry(contract.id, { type:'document', message:`Signed document uploaded (${file.name})`, by: auth.user.id });
      toast.push('Document uploaded.', 'success');
      onChange();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeAttachment = async () => {
    setBusy(true);
    try {
      await contractService.removeAttachment(contract.id);
      await contractService.addAuditEntry(contract.id, { type:'document', message:`Signed document removed (${contract.attachmentName})`, by: auth.user.id });
      toast.push('Document removed.', 'success');
      setShowRemoveModal(false);
      onChange();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (contract.attachmentBase64) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-50 text-red-500 flex items-center justify-center text-lg">📄</div>
          <div>
            <div className="text-sm font-medium">{contract.attachmentName}</div>
            <div className="text-xs text-slate-400">Uploaded signed contract</div>
          </div>
        </div>
        <div className="flex items-center gap-3 no-print">
          <a href={contract.attachmentBase64} download={contract.attachmentName} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition">Download</a>
          <a href={contract.attachmentBase64} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition">View</a>
          {auth.isAdmin && <button disabled={busy} onClick={()=>setShowRemoveModal(true)} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">Remove</button>}
        </div>
        <ConfirmModal open={showRemoveModal} onClose={()=>setShowRemoveModal(false)} onConfirm={removeAttachment} title="Remove Document" message={`Remove "${contract.attachmentName}" from this contract? This cannot be undone.`} confirmLabel="Remove" danger />
      </div>
    );
  }

  return (
    <div>
      <EmptyState title="No document uploaded" subtitle="Attach the signed contract PDF (max 3MB) so it's kept alongside this record." icon="📎" />
      {auth.isAdmin && (
        <div className="text-center -mt-2">
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFilePicked} className="hidden" />
          <button disabled={busy} onClick={()=>fileInputRef.current.click()} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{busy ? 'Uploading…' : 'Upload Signed PDF'}</button>
        </div>
      )}
    </div>
  );
}

function ContractDocument({ contractId, navigate }) {
  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    (async () => {
      const c = await contractService.getById(contractId);
      setContract(c);
      if (c) setClient(await clientService.getById(c.clientId));
      setCompany(await companyService.get());
    })();
  }, [contractId]);

  if (!contract || !client || !company) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const lineItems = contract.services ? computeServiceLineItems(contract.services) : [];
  const termYears = contract.startDate && contract.endDate ? Math.max(1, Math.round(daysBetween(contract.startDate, contract.endDate)/365)) : null;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 no-print">
        <button onClick={()=>navigate('contract:'+contract.id)} className="text-sm text-slate-500 hover:text-slate-700">← Back to Contract</button>
        <button onClick={()=>window.print()} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Print / Save as PDF</button>
      </div>

      {contract.status !== 'active' && contract.status !== 'signed' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700 mb-4 no-print">
          This is a template-generated draft. Review all clauses, values and dates carefully — and have it checked by a Cyprus lawyer — before sending it to a client for signature.
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--border)] p-10">
        <div className="flex items-center justify-center gap-6 mb-10 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center justify-center">
            {company.logo ? <img src={company.logo} alt={company.name} className="h-14 w-auto object-contain" /> : <div className="font-display text-blue-700">{company.name}</div>}
          </div>
          <div className="text-slate-300 text-xl">×</div>
          <div className="flex items-center justify-center">
            {client.logoBase64 ? <img src={client.logoBase64} alt={client.companyName} className="h-14 w-auto object-contain" /> : <div className="font-heading text-slate-700">{client.companyName}</div>}
          </div>
        </div>

        <h1 className="font-display text-center mb-1">{contract.title.toUpperCase()}</h1>
        <p className="text-center text-sm text-slate-500 mb-8">{contract.contractNumber}</p>

        <p className="text-sm text-slate-700 mb-6">
          This Agreement is made on <strong>{fmtDate(contract.createdAt)}</strong> between:
        </p>
        <p className="text-sm text-slate-700 mb-4">
          <strong>{company.name}</strong>, a company registered under the laws of the Republic of Cyprus with registration number {company.registrationNumber}, VAT number {company.vatNumber}, having its registered office at {company.registeredAddress} (the "Service Provider"),
        </p>
        <p className="text-sm text-slate-700 mb-6">and</p>
        <p className="text-sm text-slate-700 mb-8">
          <strong>{client.companyName}</strong>, {client.registrationNumber ? `a company registered with registration number ${client.registrationNumber}, ` : ''}having its registered office at {client.address || '[address]'} (the "Client").
        </p>
        <p className="text-sm text-slate-700 mb-8">The above are hereinafter jointly referred to as the "Parties".</p>

        {(() => {
          let n = 1;
          const purposeNum = n++;
          const scopeNum = lineItems.length > 0 ? n++ : null;
          const feesNum = n++;
          const confidentialityNum = n++;
          const ipNum = n++;
          const durationNum = n++;
          const terminationNum = n++;
          const liabilityNum = n++;
          const forceMajeureNum = n++;
          const governingLawNum = n++;
          const specialTermsNum = contract.specialTerms && contract.specialTerms.trim() ? n++ : null;
          const entireAgreementNum = n++;
          return (
            <React.Fragment>
              <h2 className="font-heading text-base mb-2">{purposeNum}. Purpose</h2>
              <p className="text-sm text-slate-700 mb-8 whitespace-pre-line">{contract.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.'}</p>

              {scopeNum && (
                <React.Fragment>
                  <h2 className="font-heading text-base mb-3">{scopeNum}. Scope of Services</h2>
                  <table className="w-full text-sm mb-8 border-collapse">
                    <thead>
                      <tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]">
                        <th className="py-2 pr-2">Service</th>
                        <th className="py-2 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map(i => (
                        <tr key={i.key} className="border-b border-[var(--border)]">
                          <td className="py-2 pr-2">
                            {i.label}
                            {i.key === 'platform_access' && platformSeatsSummary(contract.services.platform_access) && (
                              <div className="text-xs text-slate-400">Access: {platformSeatsSummary(contract.services.platform_access)} (exact users to be confirmed with the client)</div>
                            )}
                          </td>
                          <td className="py-2 text-right font-data">{i.unit === 'flat' ? '—' : (i.unit === 'included' || i.complimentary || i.bundledIncluded) ? 'Included' : i.qty}</td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 font-medium">Total Contract Value</td>
                        <td className="py-2 text-right font-data font-medium">{fmtMoney(contract.value, contract.currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </React.Fragment>
              )}

              <h2 className="font-heading text-base mb-2">{feesNum}. Fees & Payment</h2>
              <p className="text-sm text-slate-700 mb-2">In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of <strong>{fmtMoney(contract.value, contract.currency)}</strong>, payable <strong>{contract.paymentType.replace('_',' ')}</strong>, net {contract.paymentTermsDays} days from the date of a valid invoice.</p>
              <p className="text-sm text-slate-700 mb-8">All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of {contract.latePaymentPenalty}% per month applies to overdue amounts.</p>

              <h2 className="font-heading text-base mb-2">{confidentialityNum}. Confidentiality & Data Protection</h2>
              <p className="text-sm text-slate-700 mb-2">The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.</p>
              <p className="text-sm text-slate-700 mb-8">All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.</p>

              <h2 className="font-heading text-base mb-2">{ipNum}. Intellectual Property Rights</h2>
              <p className="text-sm text-slate-700 mb-8">All match footage, training footage, video recordings, reports, analytics outputs, player data, databases, clips and any other materials produced, collected or generated by the Service Provider under this Agreement (collectively, the "Deliverables") shall be the exclusive property of the Client. The Client shall have unrestricted, irrevocable and royalty-free rights to use, reproduce, store, modify, distribute and archive the Deliverables for any internal purpose. The Service Provider shall not use, reproduce, disclose, commercialize or share any Deliverables with any third party without the Client's prior written consent.</p>

              <h2 className="font-heading text-base mb-2">{durationNum}. Duration</h2>
              <p className="text-sm text-slate-700 mb-8">This Agreement shall commence on <strong>{fmtDate(contract.startDate)}</strong> and shall remain in force until <strong>{fmtDate(contract.endDate)}</strong>{termYears ? ` (approximately ${termYears} year${termYears>1?'s':''})` : ''}, unless terminated earlier in accordance with Section {terminationNum}.</p>

              <h2 className="font-heading text-base mb-2">{terminationNum}. Termination</h2>
              <p className="text-sm text-slate-700 mb-2">Either Party may terminate this Agreement with three (3) months' written notice, or immediately in the event of a material breach not remedied within thirty (30) days.</p>
              <p className="text-sm text-slate-700 mb-8">Upon termination or expiration of this Agreement for any reason, the Service Provider shall promptly deliver to the Client all Deliverables produced under this Agreement.</p>

              <h2 className="font-heading text-base mb-2">{liabilityNum}. Limitation of Liability</h2>
              <p className="text-sm text-slate-700 mb-8">The Service Provider shall not be responsible for sporting results, team selection decisions, or competition outcomes. Total liability under this Agreement shall not exceed the fees paid during the preceding twelve (12) months. This limitation shall not apply to breaches of confidentiality, data protection obligations, or unauthorized use of the Client's data or intellectual property.</p>

              <h2 className="font-heading text-base mb-2">{forceMajeureNum}. Force Majeure</h2>
              <p className="text-sm text-slate-700 mb-8">Neither Party shall be liable for failure to perform due to events beyond reasonable control.</p>

              <h2 className="font-heading text-base mb-2">{governingLawNum}. Governing Law & Jurisdiction</h2>
              <p className="text-sm text-slate-700 mb-8">This Agreement shall be governed by the laws of {contract.governingLaw}, with exclusive jurisdiction in {contract.jurisdiction}.</p>

              {specialTermsNum && (
                <React.Fragment>
                  <h2 className="font-heading text-base mb-2">{specialTermsNum}. Special Terms</h2>
                  <p className="text-sm text-slate-700 mb-8 whitespace-pre-line">{contract.specialTerms}</p>
                </React.Fragment>
              )}

              <h2 className="font-heading text-base mb-2">{entireAgreementNum}. Entire Agreement & Amendments</h2>
              <p className="text-sm text-slate-700 mb-12">This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.</p>
            </React.Fragment>
          );
        })()}

        <h2 className="font-heading text-base mb-6">Signatures</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
          <div>
            <div className="text-slate-500 mb-1">For {company.name}</div>
            <div className="border-b border-slate-300 h-10 mb-2"></div>
            <div className="text-xs text-slate-400">Name / Title / Date</div>
          </div>
          <div>
            <div className="text-slate-500 mb-1">For {client.companyName}</div>
            {contract.signedAt ? (
              <React.Fragment>
                <div className="italic text-slate-700 border-b border-slate-300 pb-2 mb-2">{contract.signerName}</div>
                <div className="text-xs text-slate-400">{contract.signerTitle ? contract.signerTitle + ' · ' : ''}{fmtDate(contract.signedAt)}</div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div className="border-b border-slate-300 h-10 mb-2"></div>
                <div className="text-xs text-slate-400">Name / Title / Date</div>
              </React.Fragment>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPaymentModal({ contract, client, onClose, onDone }) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [accountingRef, setAccountingRef] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = {};
    if (!description.trim()) e.description = 'Description is required.';
    if (!amount || Number(amount) <= 0) e.amount = 'Enter a positive amount.';
    if (!dueDate) e.dueDate = 'Due date is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const vat = computeVAT(client, Number(amount));
      await paymentService.create(contract.id, {
        accountingRef: accountingRef.trim() || null, description, dueDate: new Date(dueDate).toISOString(),
        amount: Number(amount), vatRate: vat.vatRate, vatAmount: vat.vatAmount,
        totalAmount: round2(Number(amount) + vat.vatAmount), currency: contract.currency,
      });
      toast.push('Payment milestone added.', 'success');
      onDone();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Add Payment Milestone" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">Add</button>
      </React.Fragment>
    }>
      <p className="text-xs text-slate-500 mb-4">This tracks the contract's cash status only — accounting issues the actual invoice from QuickBooks.</p>
      <Field label="Description" required error={errors.description}>
        <input value={description} onChange={e=>setDescription(e.target.value)} className={inputCls(errors.description)} placeholder="e.g. Q1 Platform Access Fee" />
      </Field>
      <Field label="Amount (excl. VAT)" required error={errors.amount}>
        <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={inputCls(errors.amount)} placeholder="3000.00" />
      </Field>
      <Field label="Due Date" required error={errors.dueDate}>
        <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} className={inputCls(errors.dueDate)} />
      </Field>
      <Field label="QuickBooks Invoice # (optional)">
        <input value={accountingRef} onChange={e=>setAccountingRef(e.target.value)} className={inputCls(false)} placeholder="Fill in once accounting issues it" />
      </Field>
    </Modal>
  );
}

function MarkPaidModal({ contract, payment, onClose, onDone }) {
  const auth = useAuth();
  const toast = useToast();
  const [amount, setAmount] = useState(payment.totalAmount);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0,10));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = {};
    if (!paidDate) e.paidDate = 'Date received is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const paidAt = new Date(paidDate).toISOString();
      await paymentService.markPaid(contract.id, payment.id, Number(amount), auth.user.id, paidAt);
      await contractService.addAuditEntry(contract.id, { type:'payment', message:`${payment.description} marked as paid (${fmtMoney(amount, payment.currency)}) — received ${fmtDate(paidAt)}`, by: auth.user.id });
      toast.push('Payment marked as paid.', 'success');
      onDone();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Mark Payment as Paid" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Confirm Paid</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600 mb-4">Confirm payment received for <strong>{payment.description}</strong>.</p>
      <Field label="Date Received" required error={errors.paidDate}>
        <input type="date" value={paidDate} onChange={e=>setPaidDate(e.target.value)} className={inputCls(errors.paidDate)} />
      </Field>
      <Field label="Amount Received">
        <input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} className={inputCls(false)} />
      </Field>
    </Modal>
  );
}

function MarkSignedManuallyModal({ contract, client, onClose, onDone }) {
  const auth = useAuth();
  const toast = useToast();
  const [signerName, setSignerName] = useState('');
  const [signerTitle, setSignerTitle] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = {};
    if (!signerName.trim()) e.signerName = 'Signer name is required.';
    if (!signedDate) e.signedDate = 'Signed date is required.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const signedAt = new Date(signedDate).toISOString();
      await contractService.update(contract.id, {
        status: 'active',
        signerName: signerName.trim(), signerTitle: signerTitle.trim() || null,
        signerCompany: client ? client.companyName : null, signerEmail: client ? client.contactEmail : null,
        signedAt, signerIP: null,
        documentHashBefore: null, documentHashAfter: null,
        consentElectronic: false, consentAuthorized: false, consentRead: false,
      });
      await contractService.addAuditEntry(contract.id, { type:'signed', message:`Recorded as signed manually (paper/offline signature) by ${signerName.trim()}${signerTitle.trim() ? ', ' + signerTitle.trim() : ''}`, by: auth.user.id });
      toast.push('Contract recorded as signed.', 'success');
      onDone();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Record as Signed Manually" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">{busy ? 'Saving…' : 'Record as Signed'}</button>
      </React.Fragment>
    }>
      <p className="text-xs text-slate-500 mb-4">Use this for contracts already signed on paper or outside this system — it marks the contract Active without the e-signature audit trail (no IP address or document hash, since it wasn't signed here).</p>
      <Field label="Signer Name" required error={errors.signerName}>
        <input value={signerName} onChange={e=>setSignerName(e.target.value)} className={inputCls(errors.signerName)} placeholder="e.g. Andreas Morias" />
      </Field>
      <Field label="Signer Title (optional)">
        <input value={signerTitle} onChange={e=>setSignerTitle(e.target.value)} className={inputCls(false)} />
      </Field>
      <Field label="Date Signed" required error={errors.signedDate}>
        <input type="date" value={signedDate} onChange={e=>setSignedDate(e.target.value)} className={inputCls(errors.signedDate)} />
      </Field>
    </Modal>
  );
}

function ImportSignedConfirmationModal({ contract, client, onClose, onDone }) {
  const auth = useAuth();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);

  const onFilePicked = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    setError(''); setPreview(null); setFile(null);
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.type !== 'sos-signed-confirmation') throw new Error('This is not a valid signed confirmation file.');
      if (data.contractId !== contract.id) throw new Error('This confirmation is for a different contract (' + (data.contractNumber || 'unknown') + '), not this one.');
      setFile(f);
      setPreview(data);
    } catch (err) {
      setError(err.message.includes('JSON') ? 'This file could not be read as a valid confirmation file.' : err.message);
    }
  };

  const submit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const hashMismatch = contract.documentHashBefore && preview.originalDocumentHash && contract.documentHashBefore !== preview.originalDocumentHash;
      await contractService.update(contract.id, {
        status: 'active',
        signerName: preview.signerName, signerTitle: preview.signerTitle, signerCompany: preview.signerCompany, signerEmail: preview.signerEmail,
        signedAt: preview.signedAt, signerIP: null,
        documentHashAfter: preview.documentHashAfter,
        consentElectronic: !!preview.consentElectronic, consentAuthorized: !!preview.consentAuthorized, consentRead: !!preview.consentRead,
      });
      if (preview.client && client) {
        await clientService.update(client.id, {
          companyName: preview.client.companyName || client.companyName,
          address: preview.client.address || client.address,
          vatNumber: preview.client.vatNumber || client.vatNumber,
          registrationNumber: preview.client.registrationNumber || client.registrationNumber,
        });
      }
      await contractService.addAuditEntry(contract.id, { type:'signed', message:`Signed confirmation imported for ${preview.signerName} (${preview.signerTitle})${hashMismatch ? ' — WARNING: document hash mismatch, verify terms were not altered' : ''}`, by: auth.user.id });
      toast.push(hashMismatch ? 'Imported, but the document hash did not match — please double-check the terms.' : 'Signed confirmation imported.', hashMismatch ? 'error' : 'success');
      onDone();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Import Signed Confirmation" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button disabled={!preview || busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">{busy ? 'Importing…' : 'Confirm & Mark Signed'}</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600 mb-4">Upload the <strong>signed-confirmation.json</strong> file the client downloaded after signing via a portable signing link.</p>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={onFilePicked} className="text-sm mb-3" />
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      {preview && (
        <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-slate-500">Signed by</span><span className="font-medium">{preview.signerName}, {preview.signerTitle}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Company</span><span>{preview.signerCompany}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Signed at</span><span>{fmtDateTime(preview.signedAt)}</span></div>
          {contract.documentHashBefore && preview.originalDocumentHash && contract.documentHashBefore !== preview.originalDocumentHash && (
            <p className="text-xs text-red-600 pt-2">⚠ This confirmation's document hash doesn't match your current contract — the terms may have changed since it was sent. Review carefully before confirming.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

/* =========================================================================
   PAYMENTS (Receivables + History)
   ========================================================================= */
function PaymentsReceivables({ navigate }) {
  const { contracts, clients } = useContractsData();
  const auth = useAuth();
  const toast = useToast();
  const [reminderPayment, setReminderPayment] = useState(null);
  const [markPaid, setMarkPaid] = useState(null);

  if (!contracts) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const rows = contracts.flatMap(c => c.payments.filter(p=>p.status!=='paid').map(p => ({ ...p, contractId: c.id, contract: c })));
  rows.sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

  return (
    <div className="p-4 md:p-6">
      <div className="font-display mb-6">Receivables</div>
      {rows.length === 0 ? <EmptyState title="Nothing outstanding" icon="🎉" /> : (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-3 px-4">Description</th><th className="py-3 px-4">Client</th><th className="py-3 px-4">Due</th><th className="py-3 px-4">Total</th><th className="py-3 px-4">Status</th><th className="py-3 px-4"></th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-xs">{p.description}</td>
                  <td className="py-3 px-4">{clientMap[p.contract.clientId]?.companyName}</td>
                  <td className="py-3 px-4">{fmtDate(p.dueDate)}</td>
                  <td className="py-3 px-4 font-data">{fmtMoney(p.totalAmount, p.currency)}</td>
                  <td className="py-3 px-4"><Badge status={p.status} /></td>
                  <td className="py-3 px-4 space-x-2">
                    <button onClick={()=>setReminderPayment(p)} className="text-blue-600 hover:underline text-xs">Send Reminder</button>
                    {auth.isAdmin && <button onClick={()=>setMarkPaid(p)} className="text-emerald-600 hover:underline text-xs">Mark Paid</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reminderPayment && <ReminderModal payment={reminderPayment} client={clientMap[reminderPayment.contract.clientId]} onClose={()=>setReminderPayment(null)} />}
      {markPaid && <MarkPaidModal contract={markPaid.contract} payment={markPaid} onClose={()=>setMarkPaid(null)} onDone={()=>{ setMarkPaid(null); location.reload(); }} />}
    </div>
  );
}

function ReminderModal({ payment, client, onClose }) {
  const toast = useToast();
  const days = daysBetween(new Date(), payment.dueDate);
  let tone = 'Friendly reminder', reminderType = 'pre_due_7';
  if (days === 0) { tone = 'Neutral, factual'; reminderType = 'due_today'; }
  else if (days < 0 && Math.abs(days) >= 30) { tone = 'Formal notice'; reminderType = 'overdue_30'; }
  else if (days < 0 && Math.abs(days) >= 14) { tone = 'Urgent reminder'; reminderType = 'overdue_14'; }
  else if (days < 0 && Math.abs(days) >= 7) { tone = 'Firm reminder'; reminderType = 'overdue_7'; }
  else if (days < 0) { tone = 'Firm reminder'; reminderType = 'overdue_7'; }

  const [sent, setSent] = useState(false);

  const send = async () => {
    await paymentService.addReminder(payment.contractId, payment.id, { type: reminderType, tone });
    setSent(true);
    toast.push('Reminder logged and simulated email sent.', 'success');
  };

  const markDisputed = async () => {
    await paymentService.updateStatus(payment.contractId, payment.id, 'disputed');
    toast.push('Payment marked as disputed.', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Payment Reminder" footer={
      <React.Fragment>
        {reminderType === 'overdue_14' || reminderType === 'overdue_30' ? <button onClick={markDisputed} className="px-4 py-2 text-sm rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50">Mark as Disputed</button> : null}
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Close</button>
        {!sent && <button onClick={send} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">Send Reminder</button>}
      </React.Fragment>
    }>
      <div className="text-xs text-slate-400 mb-2">Tone: {tone}</div>
      <div className="bg-slate-50 rounded-lg p-4 text-sm">
        <div className="text-xs text-slate-400 mb-2">To: {client?.contactEmail}</div>
        <div className="font-medium mb-2">Subject: {reminderType.includes('overdue') ? 'Overdue Payment Notice' : 'Payment Reminder'} — {payment.description}</div>
        <p className="text-slate-600">
          Dear {client?.contactName},<br/><br/>
          {days >= 0 ? `This is a reminder that ${payment.description} (${fmtMoney(payment.totalAmount, payment.currency)}) is due on ${fmtDate(payment.dueDate)}.` : `${payment.description} (${fmtMoney(payment.totalAmount, payment.currency)}) was due on ${fmtDate(payment.dueDate)} and remains unpaid.`}
          <br/><br/>Kind regards,<br/>Science of Sports
        </p>
      </div>
      {sent && <div className="text-xs text-emerald-600 mt-3">✓ Reminder sent and logged to audit trail.</div>}
    </Modal>
  );
}

function PaymentsHistory() {
  const { contracts, clients } = useContractsData();
  if (!contracts) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const rows = contracts.flatMap(c => c.payments.filter(p=>p.status==='paid').map(p => ({ ...p, clientId: c.clientId })));
  rows.sort((a,b) => new Date(b.paidAt) - new Date(a.paidAt));

  return (
    <div className="p-4 md:p-6">
      <div className="font-display mb-6">Payment History</div>
      {rows.length === 0 ? <EmptyState title="No payments recorded yet" icon="📒" /> : (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-3 px-4">Description</th><th className="py-3 px-4">Client</th><th className="py-3 px-4">Paid On</th><th className="py-3 px-4">Amount</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-3 px-4 text-xs">{p.description}</td>
                  <td className="py-3 px-4">{clientMap[p.clientId]?.companyName}</td>
                  <td className="py-3 px-4">{fmtDate(p.paidAt)}</td>
                  <td className="py-3 px-4 font-data text-emerald-600">{fmtMoney(p.paidAmount, p.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   CLIENTS
   ========================================================================= */
function ClientLogo({ client, size }) {
  const s = size || 40;
  if (client && client.logoBase64) {
    return <img src={client.logoBase64} alt={client.companyName} className="rounded-lg object-contain bg-white border border-[var(--border)]" style={{ width: s, height: s }} />;
  }
  const initial = (client && client.companyName ? client.companyName.trim()[0] : '?').toUpperCase();
  return (
    <div className="rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center font-heading" style={{ width: s, height: s, fontSize: s * 0.4 }}>
      {initial}
    </div>
  );
}

function ClientsPage({ navigate }) {
  const auth = useAuth();
  const toast = useToast();
  const [clients, setClients] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);

  const load = useCallback(() => clientService.getAll().then(setClients), []);
  useEffect(() => { load(); }, [load]);

  if (!clients) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="font-display">Clients</div>
        {auth.isAdmin && <button onClick={()=>setShowForm(true)} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ New Client</button>}
      </div>
      {clients.length === 0 ? <EmptyState title="No clients yet" subtitle="Add your first client to start creating contracts." ctaLabel={auth.isAdmin ? "New Client" : null} onCta={()=>setShowForm(true)} icon="🏟️" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <button key={c.id} onClick={()=>setEditClient(c)} className="text-left bg-white rounded-xl border border-[var(--border)] p-5 hover:border-blue-300 hover:shadow-sm transition cursor-pointer">
              <div className="flex items-center gap-3 mb-3">
                <ClientLogo client={c} size={44} />
                <div>
                  <div className="font-heading text-base">{c.companyName}</div>
                  <div className="text-xs text-slate-400">{c.country} · {c.currency}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600 space-y-1">
                <div>{c.contactName}</div>
                <div className="text-xs">{c.contactEmail}</div>
                <div className="text-xs">{c.contactPhone}</div>
              </div>
              {(c.vatNumber || c.registrationNumber) && (
                <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                  {c.vatNumber && <div>VAT: {c.vatNumber}</div>}
                  {c.registrationNumber && <div>Reg. No: {c.registrationNumber}</div>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {showForm && <ClientFormModal onClose={()=>setShowForm(false)} onDone={()=>{ setShowForm(false); load(); }} />}
      {editClient && <ClientFormModal client={editClient} readOnly={!auth.isAdmin} onClose={()=>setEditClient(null)} onDone={()=>{ setEditClient(null); load(); }} />}
    </div>
  );
}

function ClientFormModal({ client, readOnly, onClose, onDone }) {
  const toast = useToast();
  const isEdit = !!client;
  const [form, setForm] = useState(client ? {
    companyName: client.companyName || '', contactName: client.contactName || '', contactEmail: client.contactEmail || '',
    contactPhone: client.contactPhone || '', address: client.address || '', country: client.country || 'CY',
    vatNumber: client.vatNumber || '', registrationNumber: client.registrationNumber || '', currency: client.currency || 'EUR',
  } : { companyName:'', contactName:'', contactEmail:'', contactPhone:'', address:'', country:'CY', vatNumber:'', registrationNumber:'', currency:'EUR' });
  const [logoBase64, setLogoBase64] = useState(client && client.logoBase64 ? client.logoBase64 : null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const logoInputRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const onLogoPicked = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.push('Please choose an image file.', 'error');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.push(`Image is too large (${(file.size/1024/1024).toFixed(1)}MB). Maximum is 1MB.`, 'error');
      return;
    }
    setLogoBusy(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.readAsDataURL(file);
      });
      setLogoBase64(base64);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally { setLogoBusy(false); }
  };

  const submit = async () => {
    const e = {};
    if (!form.companyName.trim()) e.companyName = 'Required.';
    if (!form.contactName.trim()) e.contactName = 'Required.';
    if (!validateEmail(form.contactEmail)) e.contactEmail = 'Enter a valid email.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const payload = { ...form, vatNumber: form.vatNumber || null, registrationNumber: form.registrationNumber || null, logoBase64: logoBase64 || null };
      if (isEdit) {
        await clientService.update(client.id, payload);
        toast.push('Client updated.', 'success');
      } else {
        await clientService.create(payload);
        toast.push('Client created.', 'success');
      }
      onDone();
    } catch (err) {
      toast.push(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? form.companyName : 'New Client'} footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">{readOnly ? 'Close' : 'Cancel'}</button>
        {!readOnly && <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">{busy ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create')}</button>}
      </React.Fragment>
    }>
      <Field label="Club Logo">
        <div className="flex items-center gap-3">
          <ClientLogo client={{ companyName: form.companyName, logoBase64 }} size={56} />
          {!readOnly && (
            <div className="flex items-center gap-2">
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoPicked} />
              <button type="button" disabled={logoBusy} onClick={()=>logoInputRef.current.click()} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition">{logoBusy ? 'Uploading…' : (logoBase64 ? 'Change' : 'Upload')}</button>
              {logoBase64 && <button type="button" onClick={()=>setLogoBase64(null)} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">Remove</button>}
            </div>
          )}
        </div>
      </Field>
      <Field label="Company Name" required error={errors.companyName}><input disabled={readOnly} value={form.companyName} onChange={e=>set('companyName',e.target.value)} className={inputCls(errors.companyName)} /></Field>
      <Field label="Contact Name" required error={errors.contactName}><input disabled={readOnly} value={form.contactName} onChange={e=>set('contactName',e.target.value)} className={inputCls(errors.contactName)} /></Field>
      <Field label="Contact Email" required error={errors.contactEmail}><input disabled={readOnly} value={form.contactEmail} onChange={e=>set('contactEmail',e.target.value)} className={inputCls(errors.contactEmail)} /></Field>
      <Field label="Contact Phone"><input disabled={readOnly} value={form.contactPhone} onChange={e=>set('contactPhone',e.target.value)} className={inputCls(false)} /></Field>
      <Field label="Address"><input disabled={readOnly} value={form.address} onChange={e=>set('address',e.target.value)} className={inputCls(false)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Country (ISO code)"><input disabled={readOnly} value={form.country} onChange={e=>set('country',e.target.value.toUpperCase())} maxLength={2} className={inputCls(false)} /></Field>
        <Field label="Currency">
          <select disabled={readOnly} value={form.currency} onChange={e=>set('currency',e.target.value)} className={inputCls(false)}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="VAT Number (optional)"><input disabled={readOnly} value={form.vatNumber} onChange={e=>set('vatNumber',e.target.value)} className={inputCls(false)} /></Field>
        <Field label="Registration Number (optional)"><input disabled={readOnly} value={form.registrationNumber} onChange={e=>set('registrationNumber',e.target.value)} className={inputCls(false)} placeholder="e.g. HE123456" /></Field>
      </div>
    </Modal>
  );
}

/* =========================================================================
   REPORTS
   ========================================================================= */
function RevenueReport() {
  const { contracts, clients } = useContractsData();
  if (!contracts) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
  const allPayments = contracts.flatMap(c => c.payments.map(p => ({ ...p, clientId: c.clientId, contractType: c.type })));
  const paid = allPayments.filter(p => p.status === 'paid');
  const byType = {};
  paid.forEach(p => { byType[p.contractType] = (byType[p.contractType]||0) + Number(p.paidAmount||0); });
  const byClient = {};
  paid.forEach(p => { const name = clientMap[p.clientId]?.companyName || 'Unknown'; byClient[name] = (byClient[name]||0) + Number(p.paidAmount||0); });
  const total = paid.reduce((s,p)=>s+Number(p.paidAmount||0),0);

  return (
    <div className="p-4 md:p-6">
      <div className="font-display mb-6">Revenue Report</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading text-base mb-4">Revenue by Contract Type</div>
          {Object.keys(byType).length === 0 ? <EmptyState title="No revenue collected yet" /> : (
            <div className="space-y-3">
              {Object.entries(byType).map(([type,val]) => (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1"><span className="capitalize text-slate-600">{type.replace('_',' ')}</span><span className="font-data">{fmtMoney(val,'EUR')}</span></div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-[var(--blue-primary)] rounded-full" style={{ width: `${(val/total)*100}%` }}></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-xl border border-[var(--border)] p-5">
          <div className="font-heading text-base mb-4">Revenue by Client</div>
          {Object.keys(byClient).length === 0 ? <EmptyState title="No revenue collected yet" /> : (
            <div className="space-y-3">
              {Object.entries(byClient).sort((a,b)=>b[1]-a[1]).map(([name,val]) => (
                <div key={name} className="flex justify-between text-sm">
                  <span>{name}</span><span className="font-data">{fmtMoney(val,'EUR')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[var(--border)] p-5 mt-4">
        <div className="text-xs text-slate-500">Total Revenue Collected</div>
        <div className="font-data text-2xl mt-1">{fmtMoney(total,'EUR')}</div>
      </div>
    </div>
  );
}

function BoardExport() {
  const { contracts } = useContractsData();
  const toast = useToast();
  if (!contracts) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  const now = new Date();
  const mrr = contracts.filter(c=>c.status==='active' && c.paymentType==='monthly').reduce((s,c)=>s+Number(c.value||0),0);
  const arr = contracts.filter(c=>c.status==='active').reduce((s,c)=>s+Number(c.value||0),0);
  const allPayments = contracts.flatMap(c=>c.payments);
  const ytd = allPayments.filter(p=>p.status==='paid' && new Date(p.paidAt).getFullYear()===now.getFullYear()).reduce((s,p)=>s+Number(p.paidAmount||0),0);
  const outstanding = allPayments.filter(p=>p.status!=='paid').reduce((s,p)=>s+Number(p.totalAmount||0),0);
  const renewalPipeline = contracts.filter(c=>c.status==='active' && c.endDate && daysBetween(now,c.endDate)>=0 && daysBetween(now,c.endDate)<=60).length;

  const download = () => {
    const rows = [['Metric','Value'],['MRR',mrr.toFixed(2)],['ARR',arr.toFixed(2)],['YTD Revenue',ytd.toFixed(2)],['Outstanding',outstanding.toFixed(2)],['Renewal Pipeline (60d)',renewalPipeline]];
    downloadFile('sos-board-export.csv', '﻿'+rows.map(r=>r.join(',')).join('\r\n'), 'text/csv');
    toast.push('Board export downloaded.', 'success');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="font-display mb-6">Board Export</div>
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 max-w-lg">
        <dl className="text-sm space-y-3 mb-6">
          <div className="flex justify-between"><dt className="text-slate-500">MRR</dt><dd className="font-data">{fmtMoney(mrr,'EUR')}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">ARR</dt><dd className="font-data">{fmtMoney(arr,'EUR')}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">YTD Revenue</dt><dd className="font-data">{fmtMoney(ytd,'EUR')}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Outstanding</dt><dd className="font-data">{fmtMoney(outstanding,'EUR')}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Renewal Pipeline (60d)</dt><dd className="font-data">{renewalPipeline}</dd></div>
        </dl>
        <button onClick={download} className="w-full py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Download CSV</button>
      </div>
    </div>
  );
}

/* =========================================================================
   SETTINGS
   ========================================================================= */
function CompanyProfileSettings() {
  const auth = useAuth();
  const toast = useToast();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Empty company shape used when the database has no company row yet (fresh
  // install) — so the form always renders and the profile can be filled in.
  const EMPTY_COMPANY = {
    name: '', registeredAddress: '', vatNumber: '', registrationNumber: '',
    contactEmail: '', website: '', bankName: '', bankIBAN: '', bankSWIFT: '', logo: null,
  };

  useEffect(() => {
    companyService.get().then(c => {
      setCompany(c);
      setForm(c || { ...EMPTY_COMPANY });
      setLoaded(true);
    });
  }, []);
  if (!loaded || !form) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = async () => {
    await companyService.update(form);
    toast.push('Company profile updated.', 'success');
  };

  const onLogoPicked = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.push('Logo must be an image file.', 'error'); return; }
    if (file.size > 1024 * 1024) { toast.push('Logo must be under 1MB.', 'error'); return; }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    });
    const updated = await companyService.update({ logo: base64 });
    setForm(updated);
    toast.push('Logo updated.', 'success');
  };

  const removeLogo = async () => {
    const updated = await companyService.update({ logo: null });
    setForm(updated);
    toast.push('Logo removed.', 'success');
  };

  const doReset = async () => {
    setResetting(true);
    try {
      await companyService.clearClientsAndContracts();
      toast.push('All clients and contracts cleared.', 'success');
      setShowReset(false);
      setConfirmText('');
      location.reload();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="font-display mb-6">Company Profile</div>
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <Field label="Logo">
          <div className="flex items-center gap-4">
            {form.logo ? (
              <img src={form.logo} alt="Company logo" className="h-14 w-auto object-contain border border-[var(--border)] rounded-lg p-1.5" />
            ) : (
              <div className="h-14 w-24 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-slate-400">No logo</div>
            )}
            {auth.isAdmin && (
              <div className="flex gap-2">
                <label className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition cursor-pointer">
                  Upload
                  <input type="file" accept="image/*" onChange={onLogoPicked} className="hidden" />
                </label>
                {form.logo && <button onClick={removeLogo} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">Remove</button>}
              </div>
            )}
          </div>
        </Field>
        <Field label="Company Name"><input disabled={!auth.isAdmin} value={form.name} onChange={e=>set('name',e.target.value)} className={inputCls(false)} /></Field>
        <Field label="Registered Address"><input disabled={!auth.isAdmin} value={form.registeredAddress} onChange={e=>set('registeredAddress',e.target.value)} className={inputCls(false)} /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="VAT Number"><input disabled={!auth.isAdmin} value={form.vatNumber} onChange={e=>set('vatNumber',e.target.value)} className={inputCls(false)} /></Field>
          <Field label="Registration Number"><input disabled={!auth.isAdmin} value={form.registrationNumber} onChange={e=>set('registrationNumber',e.target.value)} className={inputCls(false)} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Email"><input disabled={!auth.isAdmin} value={form.contactEmail} onChange={e=>set('contactEmail',e.target.value)} className={inputCls(false)} /></Field>
          <Field label="Website"><input disabled={!auth.isAdmin} value={form.website} onChange={e=>set('website',e.target.value)} className={inputCls(false)} /></Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Bank Name"><input disabled={!auth.isAdmin} value={form.bankName} onChange={e=>set('bankName',e.target.value)} className={inputCls(false)} /></Field>
          <Field label="IBAN"><input disabled={!auth.isAdmin} value={form.bankIBAN} onChange={e=>set('bankIBAN',e.target.value)} className={inputCls(false)} /></Field>
          <Field label="SWIFT"><input disabled={!auth.isAdmin} value={form.bankSWIFT} onChange={e=>set('bankSWIFT',e.target.value)} className={inputCls(false)} /></Field>
        </div>
        {auth.isAdmin && <button onClick={save} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Save Changes</button>}
      </div>

      {auth.isAdmin && (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <div className="font-heading text-base text-red-700 mb-1">Danger Zone</div>
          <p className="text-sm text-slate-600 mb-4">Permanently delete every client and contract (including seeded demo data). Your company profile and user accounts are kept. This cannot be undone.</p>
          <button onClick={()=>setShowReset(true)} className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">Clear All Clients & Contracts</button>
        </div>
      )}

      <Modal open={showReset} onClose={()=>{ setShowReset(false); setConfirmText(''); }} title="Clear All Clients & Contracts" footer={
        <React.Fragment>
          <button onClick={()=>{ setShowReset(false); setConfirmText(''); }} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
          <button disabled={confirmText !== 'DELETE' || resetting} onClick={doReset} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">{resetting ? 'Clearing…' : 'Permanently Clear'}</button>
        </React.Fragment>
      }>
        <p className="text-sm text-slate-600 mb-4">This will permanently delete <strong>every client and contract</strong> in this system — including any signed, active, or paid ones. There is no undo. Type <strong>DELETE</strong> to confirm.</p>
        <input value={confirmText} onChange={e=>setConfirmText(e.target.value)} className={inputCls(false)} placeholder="Type DELETE to confirm" />
      </Modal>
    </div>
  );
}

function userSetupLink(user) {
  return `${location.origin}${location.pathname}#/setup/${user.setupToken}`;
}

function UsersSettings() {
  const auth = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [linkUser, setLinkUser] = useState(null);
  const [newUser, setNewUser] = useState(null);

  const load = useCallback(() => userService.getAll().then(setUsers), []);
  useEffect(() => { load(); }, [load]);

  if (!users) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  const confirmDelete = async () => {
    if (deleteTarget.id === auth.user.id) {
      toast.push('You cannot delete your own account while logged in.', 'error');
      setDeleteTarget(null);
      return;
    }
    await userService.delete(deleteTarget.id);
    toast.push('User removed.', 'success');
    setDeleteTarget(null);
    load();
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 max-w-2xl">
        <div className="font-display">Users & Roles</div>
        {auth.isAdmin && <button onClick={()=>setShowForm(true)} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">+ New User</button>}
      </div>
      <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto max-w-2xl">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-3 px-4">Name</th><th className="py-3 px-4">Email</th><th className="py-3 px-4">Role</th><th className="py-3 px-4">Status</th><th className="py-3 px-4"></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-3 px-4">{u.name}</td>
                <td className="py-3 px-4 text-xs">{u.email}</td>
                <td className="py-3 px-4 capitalize"><Badge status={u.role === 'admin' ? 'active' : 'draft'} />&nbsp;{u.role}</td>
                <td className="py-3 px-4">{u.password ? <Badge status="active" /> : <Badge status="sent" />}{!u.password && <span className="ml-1.5 text-xs text-slate-400">awaiting setup</span>}</td>
                <td className="py-3 px-4 space-x-3 whitespace-nowrap">
                  {auth.isAdmin && !u.password && <button onClick={()=>setLinkUser(u)} className="text-xs text-blue-600 hover:underline">Setup Link</button>}
                  {auth.isAdmin && <button onClick={()=>setDeleteTarget(u)} className="text-xs text-red-500 hover:underline">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!auth.isAdmin && <div className="text-xs text-slate-400 mt-3">Only admins can manage users in this prototype.</div>}
      {showForm && <UserFormModal onClose={()=>setShowForm(false)} onDone={(u)=>{ setShowForm(false); setNewUser(u); load(); }} />}
      {newUser && <SetupLinkModal user={newUser} onClose={()=>setNewUser(null)} title="User Created" />}
      {linkUser && <SetupLinkModal user={linkUser} onClose={()=>setLinkUser(null)} title="Setup Link" />}
      <ConfirmModal open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={confirmDelete} title="Remove User" message={deleteTarget ? `Remove ${deleteTarget.name} (${deleteTarget.email})? They will no longer be able to log in.` : ''} confirmLabel="Remove" danger />
    </div>
  );
}

function SetupLinkModal({ user, onClose, title }) {
  const toast = useToast();
  const link = userSetupLink(user);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.push('Setup link copied to clipboard.', 'success');
    } catch (e) {
      toast.push('Could not copy automatically — select and copy the link manually.', 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title={title} footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Close</button>
        <button onClick={copy} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">Copy Link</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600 mb-3">Send this link to <strong>{user.name}</strong> ({user.email}) via WhatsApp, Signal, or another channel you trust — there is no email sending in this prototype yet. It lets them set their own password and expires in 7 days.</p>
      <div className="bg-slate-50 rounded-lg p-3 text-xs font-data break-all border border-[var(--border)]">{link}</div>
    </Modal>
  );
}

function UserFormModal({ onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ name:'', email:'', role:'viewer' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const submit = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!validateEmail(form.email)) e.email = 'Enter a valid email address.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const user = await userService.create(form);
      toast.push('User created.', 'success');
      onDone(user);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title="New User" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
        <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">{busy ? 'Creating…' : 'Create User'}</button>
      </React.Fragment>
    }>
      <p className="text-xs text-slate-500 mb-4">No password needed here — after creating the user, you'll get a one-time setup link to send them so they can choose their own password.</p>
      <Field label="Full Name" required error={errors.name}>
        <input value={form.name} onChange={e=>set('name',e.target.value)} className={inputCls(errors.name)} />
      </Field>
      <Field label="Email" required error={errors.email}>
        <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} className={inputCls(errors.email)} />
      </Field>
      <Field label="Role">
        <select value={form.role} onChange={e=>set('role',e.target.value)} className={inputCls(false)}>
          <option value="viewer">Viewer (read-only)</option>
          <option value="admin">Admin (full access)</option>
        </select>
      </Field>
    </Modal>
  );
}

/* =========================================================================
   CLIENT-FACING SIGNING FLOW  (#/sign/{contractId}/{token})
   ========================================================================= */
// Map a frozen document snapshot (stored from DB rows, so keys may be snake_case)
// onto the camelCase shape the SigningFlow screens already expect. Tolerant of
// both cases so it works whether the Edge Function stored snake_case or camelCase.
function normalizeSnapshot(snapshot) {
  const pick = (obj, ...keys) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return undefined;
  };
  const c = (snapshot && snapshot.contract) || {};
  const cl = (snapshot && snapshot.client) || {};
  const co = (snapshot && snapshot.company) || {};

  const contract = {
    id: pick(c, 'id'),
    contractNumber: pick(c, 'contractNumber', 'contract_number'),
    version: pick(c, 'version'),
    title: pick(c, 'title'),
    description: pick(c, 'description'),
    value: pick(c, 'value'),
    currency: pick(c, 'currency'),
    startDate: pick(c, 'startDate', 'start_date'),
    endDate: pick(c, 'endDate', 'end_date'),
    governingLaw: pick(c, 'governingLaw', 'governing_law'),
    jurisdiction: pick(c, 'jurisdiction'),
    paymentType: pick(c, 'paymentType', 'payment_type'),
    paymentTermsDays: pick(c, 'paymentTermsDays', 'payment_terms_days'),
    latePaymentPenalty: pick(c, 'latePaymentPenalty', 'late_payment_penalty'),
    specialTerms: pick(c, 'specialTerms', 'special_terms'),
    services: pick(c, 'services'),
    documentHashBefore: pick(c, 'documentHashBefore', 'document_hash_before'),
    // status intentionally read from the request row, not the snapshot
    status: pick(c, 'status'),
  };
  const client = {
    id: pick(cl, 'id'),
    companyName: pick(cl, 'companyName', 'company_name'),
    contactName: pick(cl, 'contactName', 'contact_name'),
    contactEmail: pick(cl, 'contactEmail', 'contact_email'),
    address: pick(cl, 'address'),
    vatNumber: pick(cl, 'vatNumber', 'vat_number'),
    registrationNumber: pick(cl, 'registrationNumber', 'registration_number'),
  };
  const company = {
    name: pick(co, 'name'),
    logo: pick(co, 'logo'),
    registeredAddress: pick(co, 'registeredAddress', 'registered_address'),
    contactEmail: pick(co, 'contactEmail', 'contact_email'),
    vatNumber: pick(co, 'vatNumber', 'vat_number'),
    registrationNumber: pick(co, 'registrationNumber', 'registration_number'),
  };
  return { contract, client, company };
}

function SigningFlow({ contractId, portablePayload, reqToken }) {
  const toast = useToast();
  const isPortable = !!portablePayload;
  const isServer = !!reqToken; // server-backed mode via ?req=<token>
  const [screen, setScreen] = useState(1);
  // OTP state (server mode only)
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  const [sigName, setSigName] = useState('');
  const [sigTitle, setSigTitle] = useState('');
  const [sigCompany, setSigCompany] = useState('');
  const [typedSig, setTypedSig] = useState('');
  const [useTyped, setUseTyped] = useState(false);
  const [consents, setConsents] = useState({ authorized:false, read:false, electronic:false });
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [signedResult, setSignedResult] = useState(null);

  const [editingClientDetails, setEditingClientDetails] = useState(false);
  const [clientDetailsForm, setClientDetailsForm] = useState(null);
  const [clientDetailsErrors, setClientDetailsErrors] = useState({});
  const [savingClientDetails, setSavingClientDetails] = useState(false);

  useEffect(() => {
    (async () => {
      // SERVER MODE: fetch the frozen snapshot for this signing token.
      if (isServer) {
        try {
          const res = await signingService.getSigningRequest(reqToken);
          const request = res.request;
          const { contract, client, company } = normalizeSnapshot(request.document_snapshot);
          setContract(contract);
          setClient(client);
          setCompany(company);
          setSigCompany(client ? client.companyName || '' : '');
          if (client) setClientDetailsForm({ companyName: client.companyName || '', address: client.address || '', vatNumber: client.vatNumber || '', registrationNumber: client.registrationNumber || '' });
          // Pre-fill the confirm-email step from the request's signer email.
          if (request.signer_email && !client?.contactEmail) {
            setClient(cl => ({ ...(cl || {}), contactEmail: request.signer_email }));
          }
          if (request.status === 'signed') setAlreadySigned(true);
        } catch (err) {
          setLoadError(err.message || 'This signing link could not be opened. Ask the sender for a fresh link.');
        }
        return;
      }
      if (isPortable) {
        try {
          const data = await decodePortablePayload(portablePayload);
          setContract(data.contract);
          setClient(data.client);
          setCompany(data.company);
          setSigCompany(data.client ? data.client.companyName : '');
          if (data.client) setClientDetailsForm({ companyName: data.client.companyName || '', address: data.client.address || '', vatNumber: data.client.vatNumber || '', registrationNumber: data.client.registrationNumber || '' });
        } catch (err) {
          setLoadError('This signing link could not be read — it may be incomplete or corrupted. Ask the sender for a fresh link.');
        }
        return;
      }
      const c = await contractService.getById(contractId);
      setContract(c);
      if (c) {
        const cl = await clientService.getById(c.clientId);
        setClient(cl);
        setSigCompany(cl ? cl.companyName : '');
        if (cl) setClientDetailsForm({ companyName: cl.companyName || '', address: cl.address || '', vatNumber: cl.vatNumber || '', registrationNumber: cl.registrationNumber || '' });
      }
      setCompany(await companyService.get());
    })();
  }, [contractId, isPortable, portablePayload, isServer, reqToken]);

  const saveClientDetails = async () => {
    const e = {};
    if (!clientDetailsForm.companyName.trim()) e.companyName = 'Company name is required.';
    setClientDetailsErrors(e);
    if (Object.keys(e).length) return;
    setSavingClientDetails(true);
    try {
      // Portable AND server mode: the signer has no DB auth, so edits are
      // session-only — they display on screen but don't write the client record.
      if (isPortable || isServer) {
        const updated = { ...client, companyName: clientDetailsForm.companyName.trim(), address: clientDetailsForm.address.trim(), vatNumber: clientDetailsForm.vatNumber.trim() || null, registrationNumber: clientDetailsForm.registrationNumber.trim() || null };
        setClient(updated);
        setSigCompany(updated.companyName);
        setEditingClientDetails(false);
        toast.push('Details updated for this session — they will be included on your signed contract.', 'success');
        return;
      }
      const updated = await clientService.update(client.id, {
        companyName: clientDetailsForm.companyName.trim(),
        address: clientDetailsForm.address.trim(),
        vatNumber: clientDetailsForm.vatNumber.trim() || null,
        registrationNumber: clientDetailsForm.registrationNumber.trim() || null,
      });
      setClient(updated);
      setSigCompany(updated.companyName);
      await contractService.addAuditEntry(contract.id, { type:'client_update', message:`Client updated their company details via the signing link (${updated.companyName})`, by: null });
      setEditingClientDetails(false);
      toast.push('Company details updated.', 'success');
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setSavingClientDetails(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <div className="font-heading mb-2">Couldn't open this document</div>
          <p className="text-sm text-slate-500">{loadError}</p>
        </div>
      </div>
    );
  }

  // Server mode: the request row already reports this contract as signed.
  if (alreadySigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-heading mb-2">This contract has already been signed.</div>
          <p className="text-sm text-slate-500">{company ? `Contact ${company.contactEmail} if you need another copy.` : 'Contact the sender if you need another copy.'}</p>
        </div>
      </div>
    );
  }

  if (!contract || !client || !company) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)]"><div className="text-white text-sm">Loading document…</div></div>;
  }

  if (contract.status === 'active' || contract.status === 'signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-heading mb-2">This document has already been signed</div>
          <p className="text-sm text-slate-500">Contact {company.contactEmail} if you need another copy.</p>
        </div>
      </div>
    );
  }

  const linkExpiry = new Date(contract.sentAt || nowISO());
  linkExpiry.setDate(linkExpiry.getDate() + 7);
  // In server mode the Edge Functions enforce expiry authoritatively on every
  // call (and surface it as loadError), so we don't gate the UI on the snapshot.
  const expired = !isServer && new Date() > linkExpiry;

  const confirmIdentity = async () => {
    if (!validateEmail(emailInput)) { setEmailError('Enter a valid email address.'); return; }
    if (emailInput.toLowerCase() !== client.contactEmail.toLowerCase()) { setEmailError('This email does not match our records for this contract.'); return; }
    setEmailError('');
    // SERVER MODE: email confirmed -> send a 6-digit OTP and go to the OTP screen.
    if (isServer) {
      setOtpBusy(true);
      try {
        await signingService.sendOtp(reqToken);
        setOtpError('');
        setScreen(6); // OTP screen (server mode only)
      } catch (err) {
        setEmailError(err.message || 'Could not send a verification code. Please try again.');
      } finally {
        setOtpBusy(false);
      }
      return;
    }
    setScreen(2);
  };

  // SERVER MODE: verify the emailed 6-digit code, then advance to the document review.
  const verifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length < 4) { setOtpError('Enter the code from your email.'); return; }
    setOtpBusy(true);
    try {
      await signingService.verifyOtp(reqToken, code);
      setOtpError('');
      setScreen(2);
    } catch (err) {
      setOtpError(err.message || 'Incorrect code.');
    } finally {
      setOtpBusy(false);
    }
  };

  const resendOtp = async () => {
    setOtpBusy(true);
    try {
      await signingService.sendOtp(reqToken);
      setOtpError('');
      toast.push('A new code has been sent to your email.', 'success');
    } catch (err) {
      setOtpError(err.message || 'Could not resend the code.');
    } finally {
      setOtpBusy(false);
    }
  };

  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 20) setScrolledToBottom(true);
  };

  const startDraw = (e) => {
    drawing.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.beginPath(); ctx.moveTo(x,y);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x,y); ctx.stroke();
    setCanvasEmpty(false);
  };
  const endDraw = () => { drawing.current = false; };
  const clearCanvas = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0,0,canvasRef.current.width, canvasRef.current.height);
    setCanvasEmpty(true);
  };

  const allConsentsChecked = consents.authorized && consents.read && consents.electronic;
  const hasSignature = useTyped ? typedSig.trim().length > 0 : !canvasEmpty;

  const submitSignature = async () => {
    const e = {};
    if (!sigName.trim()) e.sigName = 'Full name is required.';
    if (!sigTitle.trim()) e.sigTitle = 'Job title is required.';
    if (!hasSignature) e.signature = 'A signature is required.';
    if (!allConsentsChecked) e.consents = 'All three confirmations are required.';
    setFormErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const hashAfter = await sha256(contract.title + contract.description + contract.value);
      const signedAt = nowISO();

      // CAPTURE THE SIGNATURE as a PNG data URL (drawn canvas or typed name).
      let signatureImageBase64 = null;
      if (useTyped) {
        // Render the typed name onto an offscreen canvas in a cursive-ish font.
        const tmp = document.createElement('canvas');
        tmp.width = 460; tmp.height = 140;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#ffffff';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.fillStyle = '#0f172a';
        tctx.font = '40px "Segoe Script", "Brush Script MT", cursive';
        tctx.textBaseline = 'middle';
        tctx.fillText(typedSig.trim(), 20, tmp.height / 2);
        signatureImageBase64 = tmp.toDataURL('image/png');
      } else if (canvasRef.current) {
        signatureImageBase64 = canvasRef.current.toDataURL('image/png');
      }

      // SERVER MODE: record the signature via the Edge Function (the evidence write).
      if (isServer) {
        const res = await signingService.recordSignature(reqToken, {
          signerName: sigName, signerTitle: sigTitle, signerCompany: sigCompany,
          consents: { electronic: consents.electronic, authorized: consents.authorized, read: consents.read },
          signatureImageBase64,
        });
        setSignedResult({ signedAt: res.signedAt });
        setScreen(5);
        return;
      }

      if (isPortable) {
        const confirmation = {
          type: 'sos-signed-confirmation', version: 1,
          contractId: contract.id, contractNumber: contract.contractNumber, contractTitle: contract.title,
          originalDocumentHash: contract.documentHashBefore || null, documentHashAfter: hashAfter,
          client: { companyName: client.companyName, address: client.address, vatNumber: client.vatNumber, registrationNumber: client.registrationNumber },
          signerName: sigName, signerTitle: sigTitle, signerCompany: sigCompany, signerEmail: emailInput,
          signedAt,
          consentElectronic: consents.electronic, consentAuthorized: consents.authorized, consentRead: consents.read,
        };
        setSignedResult({ signedAt, confirmation });
        setScreen(5);
        return;
      }

      await contractService.update(contract.id, {
        status: 'active',
        signerName: sigName, signerTitle: sigTitle, signerCompany: sigCompany, signerEmail: emailInput,
        signedAt, signerIP: '203.0.113.42',
        documentHashAfter: hashAfter,
        consentElectronic: consents.electronic, consentAuthorized: consents.authorized, consentRead: consents.read,
      });
      await contractService.addAuditEntry(contract.id, { type:'signed', message:`Contract signed by ${sigName} (${sigTitle})`, by: null });
      setSignedResult({ signedAt });
      setScreen(5);
    } catch (err) {
      toast.push(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--navy-deep)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="text-white font-display">SOS Contracts</div>
          <div className="text-slate-400 text-xs mt-1">Secure Electronic Signature</div>
        </div>

        {expired ? (
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="text-4xl mb-4">⏰</div>
            <div className="font-heading mb-2">This signing link has expired</div>
            <p className="text-sm text-slate-500">Please contact {company.contactEmail} to request a new signing link.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            {screen === 1 && (
              <div className="p-8">
                <div className="font-heading mb-1">You have been invited to sign a document</div>
                <p className="text-sm text-slate-500 mb-6">{company.name} has sent you a contract for electronic signature.</p>
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="text-sm font-medium">{contract.title}</div>
                  <div className="text-xs text-slate-400 mt-1">From {company.name}</div>
                </div>
                <Field label="Confirm your email address to continue" required error={emailError}>
                  <input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} className={inputCls(emailError)} placeholder="you@yourclub.com" />
                </Field>
                <p className="text-xs text-amber-600 mb-4">This link expires on {fmtDate(linkExpiry.toISOString())}.</p>
                <button onClick={confirmIdentity} disabled={otpBusy} className="w-full py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{otpBusy ? 'Sending code…' : 'Continue'}</button>
                <p className="text-xs text-slate-400 mt-4 text-center">Questions? Contact {company.contactEmail}</p>
              </div>
            )}

            {/* OTP screen — server mode only (inserted between email and review) */}
            {screen === 6 && (
              <div className="p-8">
                <div className="font-heading mb-1">Verify it's you</div>
                <p className="text-sm text-slate-500 mb-6">We've emailed a 6-digit code to <strong>{emailInput}</strong>. Enter it below to continue.</p>
                <Field label="Verification code" required error={otpError}>
                  <input
                    value={otpCode}
                    onChange={e=>setOtpCode(e.target.value.replace(/[^0-9]/g,'').slice(0,6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className={`${inputCls(otpError)} tracking-[0.4em] text-center text-lg font-data`}
                  />
                </Field>
                <button onClick={verifyOtp} disabled={otpBusy} className="w-full py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 mb-4">{otpBusy ? 'Verifying…' : 'Verify'}</button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={()=>{ setOtpCode(''); setOtpError(''); setScreen(1); }} className="text-slate-500 hover:underline">Change email</button>
                  <button type="button" onClick={resendOtp} disabled={otpBusy} className="text-blue-600 hover:underline disabled:opacity-50">Resend code</button>
                </div>
              </div>
            )}

            {screen === 2 && (
              <div className="p-8">
                <div className="font-heading mb-4">Review Document</div>
                <div ref={scrollRef} onScroll={onScroll} className="border border-[var(--border)] rounded-lg p-5 h-80 overflow-y-auto text-sm text-slate-600 mb-4 bg-slate-50">
                  <h3 className="font-semibold text-slate-800 mb-2">{contract.title}</h3>
                  <p className="mb-3"><strong>Between:</strong> {company.name} ("Service Provider") and {client.companyName} ("Client").</p>
                  <p className="mb-3">{contract.description}</p>
                  <p className="mb-3"><strong>Contract Value:</strong> {fmtMoney(contract.value, contract.currency)} ({contract.paymentType.replace('_',' ')}, net {contract.paymentTermsDays} days).</p>
                  <p className="mb-3"><strong>Term:</strong> {fmtDate(contract.startDate)} to {fmtDate(contract.endDate)}.</p>
                  <p className="mb-3"><strong>Late Payment:</strong> A penalty of {contract.latePaymentPenalty}% per month applies to overdue amounts.</p>
                  <p className="mb-3"><strong>Governing Law:</strong> This agreement is governed by the laws of {contract.governingLaw}, with exclusive jurisdiction in {contract.jurisdiction}.</p>
                  <p className="mb-3">Both parties agree to the confidentiality of data shared under this agreement and to use analytical outputs solely for internal performance purposes unless otherwise agreed in writing.</p>
                  <p className="mb-3">This agreement may be terminated by either party with 30 days' written notice. Outstanding invoices remain payable regardless of termination.</p>
                  <p className="text-xs text-slate-400 mt-6">— End of document —</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(contract.title + '\n\n' + contract.description)}`} download={`${contract.contractNumber}.txt`} className="text-xs text-blue-600 hover:underline">Download document</a>
                  <button disabled={!scrolledToBottom} onClick={()=>setScreen(3)} className="px-5 py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {scrolledToBottom ? 'Proceed to Sign' : 'Scroll to the bottom to continue'}
                  </button>
                </div>
              </div>
            )}

            {screen === 3 && (
              <div className="p-8">
                <div className="font-heading mb-4">Confirm Agreement Summary</div>
                <div className="bg-slate-50 rounded-lg p-5 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="font-medium">{contract.title}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Parties</span><span className="font-medium text-right">{company.name} &amp; {client.companyName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Value</span><span className="font-data">{fmtMoney(contract.value, contract.currency)} / {contract.paymentType==='monthly'?'month':'year'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Start Date</span><span>{fmtDate(contract.startDate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">End Date</span><span>{fmtDate(contract.endDate)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Governed by</span><span>{contract.governingLaw}</span></div>
                </div>

                <div className="mt-4 border border-[var(--border)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium">Your Company Details</div>
                    {!editingClientDetails && <button onClick={()=>setEditingClientDetails(true)} className="text-xs text-blue-600 hover:underline">Edit</button>}
                  </div>
                  {!editingClientDetails ? (
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>{client.companyName}</div>
                      {client.address && <div className="text-xs text-slate-400">{client.address}</div>}
                      <div className="text-xs text-slate-400">
                        {client.vatNumber ? `VAT: ${client.vatNumber}` : 'VAT: —'} · {client.registrationNumber ? `Reg. No: ${client.registrationNumber}` : 'Reg. No: —'}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-3">Correct your company details below if anything is wrong — these are saved to your record and reflected on the contract document. This does not change the deal terms above.</p>
                      <Field label="Company Name" required error={clientDetailsErrors.companyName}>
                        <input value={clientDetailsForm.companyName} onChange={e=>setClientDetailsForm(f=>({...f,companyName:e.target.value}))} className={inputCls(clientDetailsErrors.companyName)} />
                      </Field>
                      <Field label="Registered Address">
                        <input value={clientDetailsForm.address} onChange={e=>setClientDetailsForm(f=>({...f,address:e.target.value}))} className={inputCls(false)} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="VAT Number">
                          <input value={clientDetailsForm.vatNumber} onChange={e=>setClientDetailsForm(f=>({...f,vatNumber:e.target.value}))} className={inputCls(false)} />
                        </Field>
                        <Field label="Registration Number">
                          <input value={clientDetailsForm.registrationNumber} onChange={e=>setClientDetailsForm(f=>({...f,registrationNumber:e.target.value}))} className={inputCls(false)} />
                        </Field>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={()=>{ setEditingClientDetails(false); setClientDetailsForm({ companyName: client.companyName || '', address: client.address || '', vatNumber: client.vatNumber || '', registrationNumber: client.registrationNumber || '' }); }} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] hover:bg-slate-50">Cancel</button>
                        <button disabled={savingClientDetails} onClick={saveClientDetails} className="px-3 py-1.5 text-xs rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700">{savingClientDetails ? 'Saving…' : 'Save Details'}</button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between mt-6">
                  <button onClick={()=>setScreen(2)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Back</button>
                  <button onClick={()=>setScreen(4)} className="px-5 py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Continue to Signature</button>
                </div>
              </div>
            )}

            {screen === 4 && (
              <div className="p-8">
                <div className="font-heading mb-4">Signature</div>
                <Field label="Full Name" required error={formErrors.sigName}>
                  <input value={sigName} onChange={e=>setSigName(e.target.value)} className={inputCls(formErrors.sigName)} />
                </Field>
                <Field label="Job Title" required error={formErrors.sigTitle}>
                  <input value={sigTitle} onChange={e=>setSigTitle(e.target.value)} className={inputCls(formErrors.sigTitle)} />
                </Field>
                <Field label="Company Name">
                  <input value={sigCompany} onChange={e=>setSigCompany(e.target.value)} className={inputCls(false)} />
                </Field>

                <Field label="Signature" required error={formErrors.signature}>
                  {!useTyped ? (
                    <div>
                      <canvas
                        ref={canvasRef} width={460} height={140}
                        className="border border-[var(--border)] rounded-lg w-full touch-none bg-white"
                        onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                        onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
                      ></canvas>
                      <div className="flex justify-between mt-2">
                        <button type="button" onClick={clearCanvas} className="text-xs text-slate-500 hover:underline">Clear</button>
                        <button type="button" onClick={()=>setUseTyped(true)} className="text-xs text-blue-600 hover:underline">Type instead</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <input value={typedSig} onChange={e=>setTypedSig(e.target.value)} placeholder="Type your full name as signature" className={`${inputCls(formErrors.signature)} font-serif italic text-lg`} />
                      <button type="button" onClick={()=>setUseTyped(false)} className="text-xs text-blue-600 hover:underline mt-2">Draw instead</button>
                    </div>
                  )}
                </Field>

                <div className="space-y-2 mb-4 mt-2">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={consents.authorized} onChange={e=>setConsents(c=>({...c,authorized:e.target.checked}))} className="mt-0.5" />
                    <span>I confirm I am authorized to sign on behalf of {sigCompany || 'the Company'}</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={consents.read} onChange={e=>setConsents(c=>({...c,read:e.target.checked}))} className="mt-0.5" />
                    <span>I have read and agree to all terms of this agreement</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={consents.electronic} onChange={e=>setConsents(c=>({...c,electronic:e.target.checked}))} className="mt-0.5" />
                    <span>I consent to signing this document electronically, which is legally binding</span>
                  </label>
                  {formErrors.consents && <p className="text-xs text-red-500">{formErrors.consents}</p>}
                </div>

                <div className="flex justify-between">
                  <button onClick={()=>setScreen(3)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Back</button>
                  <button disabled={!allConsentsChecked || !hasSignature || busy} onClick={submitSignature} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {busy ? 'Signing…' : 'Sign Agreement'}
                  </button>
                </div>
              </div>
            )}

            {screen === 5 && signedResult && (
              <div className="p-8 text-center">
                <div className="text-5xl mb-4">✅</div>
                <div className="font-heading text-lg mb-1">Agreement Successfully Signed</div>
                <p className="text-sm text-slate-500 mb-6">Thank you, {sigName}.</p>
                <div className="bg-slate-50 rounded-lg p-5 text-sm text-left space-y-2 mb-6">
                  <div className="flex justify-between"><span className="text-slate-500">Contract</span><span className="font-medium">{contract.title}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Signed by</span><span>{sigName}, {sigTitle}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Date &amp; Time</span><span>{fmtDateTime(signedResult.signedAt)}</span></div>
                </div>

                {isServer ? (
                  /* SERVER MODE: signature recorded server-side; email confirmation is automatic. */
                  <p className="text-sm text-slate-600 mb-6">Thank you — this contract is now signed. A copy and confirmation have been sent by email. You can close this page.</p>
                ) : isPortable ? (
                  <React.Fragment>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-left mb-6">
                      <strong>One more step:</strong> download the confirmation file below and send it back to {company.contactEmail} (email/WhatsApp) so {company.name} can record your signature on their side. This link doesn't connect to their system directly.
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                      <a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(signedResult.confirmation, null, 2))}`} download={`${contract.contractNumber}-signed-confirmation.json`} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Download Signed Confirmation</a>
                    </div>
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <p className="text-xs text-slate-400 mb-6">A signed copy has been sent to {emailInput} (simulated).</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                      <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(contract.title + '\n\nSigned by ' + sigName + ' on ' + fmtDateTime(signedResult.signedAt))}`} download={`${contract.contractNumber}-signed.txt`} className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-slate-50">Download Signed Document</a>
                      <a href={`data:text/plain;charset=utf-8,${encodeURIComponent('Certificate of Signature\n\nContract: ' + contract.title + '\nSigned by: ' + sigName + ' (' + sigTitle + ')\nDate: ' + fmtDateTime(signedResult.signedAt) + '\nIP: 203.0.113.42')}`} download={`${contract.contractNumber}-certificate.txt`} className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-slate-50">Download Certificate</a>
                    </div>
                  </React.Fragment>
                )}
                <p className="text-xs text-slate-400">{company.name} · {company.contactEmail}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   APP SHELL / ROUTER
   ========================================================================= */
function useHashRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function AuthedApp() {
  const [route, setRoute] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = (r) => { setRoute(r); window.scrollTo(0,0); };

  let page = null;
  if (route === 'dashboard') page = <Dashboard navigate={navigate} />;
  else if (route === 'contracts:all') page = <ContractsList navigate={navigate} />;
  else if (route === 'contracts:new') page = <ContractForm navigate={navigate} />;
  else if (route.startsWith('contracts:edit:')) page = <ContractForm navigate={navigate} editContractId={route.slice('contracts:edit:'.length)} />;
  else if (route.startsWith('contract:')) page = <ContractDetail contractId={route.split(':')[1]} navigate={navigate} />;
  else if (route.startsWith('document:')) page = <ContractDocument contractId={route.split(':')[1]} navigate={navigate} />;
  else if (route === 'payments:receivables') page = <PaymentsReceivables navigate={navigate} />;
  else if (route === 'payments:history') page = <PaymentsHistory />;
  else if (route === 'clients') page = <ClientsPage navigate={navigate} />;
  else if (route === 'reports:revenue') page = <RevenueReport />;
  else if (route === 'reports:board') page = <BoardExport />;
  else if (route === 'settings:company') page = <CompanyProfileSettings />;
  else if (route === 'settings:users') page = <UsersSettings />;
  else page = <Dashboard navigate={navigate} />;

  return (
    <div className="flex min-h-screen">
      <Sidebar route={route} navigate={navigate} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className="flex-1 min-w-0">
        <div className="md:hidden sticky top-0 z-20 bg-[var(--navy-deep)] px-4 py-3 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <img src="Logo-scios-dark.png" alt="SCIOS" className="h-6 w-auto object-contain" />
            <div className="text-white font-heading text-sm">SOS Contracts</div>
          </div>
          <button onClick={()=>setMobileOpen(true)} className="text-white text-xl leading-none">☰</button>
        </div>
        {page}
      </div>
    </div>
  );
}

function AccountSetupFlow({ token }) {
  const [user, setUser] = useState(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { userService.getBySetupToken(token).then(setUser); }, [token]);

  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)]"><div className="text-white text-sm">Loading…</div></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">⏰</div>
          <div className="font-heading mb-2">This setup link is invalid or has expired</div>
          <p className="text-sm text-slate-500">Ask your admin to send you a new setup link.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✅</div>
          <div className="font-heading mb-2">Password set</div>
          <p className="text-sm text-slate-500 mb-5">You can now log in with your email and new password.</p>
          <a href={location.pathname} className="inline-block px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Go to Login</a>
        </div>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await userService.completeSetup(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="Logo-scios-dark.png" alt="SCIOS" className="h-14 w-auto object-contain mx-auto mb-4" />
          <div className="text-white font-display">SOS Contracts</div>
          <div className="text-slate-400 text-sm mt-1">Set up your account</div>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl p-8">
          <p className="text-sm text-slate-600 mb-5">Welcome, {user.name}. Choose a password for <strong>{user.email}</strong> to activate your account.</p>
          <Field label="New Password" required>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls(false)} placeholder="Minimum 8 characters" autoFocus />
          </Field>
          <Field label="Confirm Password" required>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className={inputCls(false)} />
          </Field>
          {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
          <button disabled={busy} className="w-full py-2.5 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {busy ? 'Saving…' : 'Set Password & Activate'}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const hash = useHashRoute();
  const auth = useAuth();

  // Server-backed signing mode: ?req=<token> points at a real signing request
  // stored in Supabase (with OTP + evidence-grade signature capture). This is
  // the primary flow now; ?sign= (portable) and #/sign/ (local) remain fallbacks.
  const reqParam = new URLSearchParams(location.search).get('req');
  if (reqParam) {
    return <SigningFlow reqToken={reqParam} />;
  }

  const signParam = new URLSearchParams(location.search).get('sign');
  if (signParam) {
    return <SigningFlow portablePayload={signParam} />;
  }

  const signMatch = hash.match(/^#\/sign\/([^/]+)\/([^/]+)/);
  if (signMatch) {
    return <SigningFlow contractId={signMatch[1]} />;
  }

  const setupMatch = hash.match(/^#\/setup\/([^/]+)/);
  if (setupMatch) {
    return <AccountSetupFlow token={setupMatch[1]} />;
  }

  if (auth.loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)]"><div className="text-white text-sm">Loading…</div></div>;
  }
  if (!auth.user) return <LoginScreen />;
  return <AuthedApp />;
}

function Root() {
  // No localStorage seeding — data now lives in Supabase (the real backend).
  return (
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  );
}

export default Root;
