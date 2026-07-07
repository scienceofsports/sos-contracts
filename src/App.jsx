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
  summarizeAgreement,
  analysisScopeText,
  seasonLabelFromDates,
  commercialModelText,
  commercialValue,
  PAYMENT_MODEL_LABELS,
  SPECIAL_TERM_CLAUSES,
  parseSpecialTerms,
  serviceLevelsLines,
  vatSummary,
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
  effectiveStatus,
  daysOverdue,
  effectiveContractStatus,
  agingBucket,
  AGING_LABELS,
  toCSV,
  downloadFile,
} from './lib/format.js';
import { decodePortablePayload } from './lib/portable.js';
import { downloadContractPdf } from './lib/contractPdf.js';
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
          <div className="text-white font-display">SCIOS Contracts</div>
          <div className="text-slate-400 text-sm mt-1">Science of Sports — Internal Contract Management</div>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="sos-rainbow" />
          <div className="p-8">
            <Field label="Email" required>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className={inputCls(false)} placeholder="admin@scienceofsports.com" autoFocus />
            </Field>
            <Field label="Password" required>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className={inputCls(false)} placeholder="••••••••" />
            </Field>
            {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
            <button disabled={busy} className="w-full py-2.5 bg-[var(--cyan)] text-[var(--navy-deep)] rounded-lg text-sm font-semibold hover:bg-[var(--cyan-deep)] transition disabled:opacity-50">
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </form>
        <div className="text-center text-slate-500 text-xs mt-6">Transforming matches into knowledge.</div>
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
        <div className="sos-rainbow" />
        <button type="button" onClick={() => { navigate('dashboard'); setMobileOpen(false); }} className="px-5 py-6 border-b border-white/10 flex flex-col items-start gap-2 hover:bg-white/5 transition text-left w-full" title="Go to Dashboard">
          <img src="Logo-scios-dark.png" alt="SCIOS" className="h-12 w-auto object-contain" />
          <div className="text-white font-heading">SCIOS Contracts</div>
        </button>
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition border-l-2 ${isActive(item.key) && !item.children ? 'bg-[var(--navy-mid)] text-white border-[var(--cyan)]' : 'border-transparent text-slate-300 hover:bg-[var(--navy-mid)]/60 hover:text-white'}`}
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition border-l-2 ${route === child.key ? 'bg-[var(--navy-mid)] text-[var(--cyan)] border-[var(--cyan)]' : 'border-transparent text-slate-400 hover:bg-[var(--navy-mid)]/60 hover:text-white'}`}
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
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      <div className="font-data text-3xl font-bold mt-1.5" style={{ color: color || 'var(--cyan-deep)' }}>{value}</div>
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
  // Overdue is COMPUTED live from due dates (a pending payment past due = overdue).
  const outstanding = allPayments.filter(p => { const st = effectiveStatus(p); return st === 'pending' || st === 'overdue' || st === 'disputed'; }).reduce((s,p) => s + Number(p.totalAmount||0), 0);
  const overdue = allPayments.filter(p => effectiveStatus(p) === 'overdue').reduce((s,p) => s + Number(p.totalAmount||0), 0);
  // Aged overdue buckets (the board/collections view of the money that's late).
  const overduePays = allPayments.filter(p => effectiveStatus(p) === 'overdue');
  const overdueBuckets = { d30: 0, d60: 0, d90: 0 };
  overduePays.forEach(p => { const d = daysOverdue(p); const amt = Number(p.totalAmount||0); if (d > 90) overdueBuckets.d90 += amt; else if (d > 60) overdueBuckets.d60 += amt; else overdueBuckets.d30 += amt; });
  const renewalCount = contracts.filter(c => c.status === 'active' && c.endDate && daysBetween(now, c.endDate) >= 0 && daysBetween(now, c.endDate) <= 60).length;

  const stages = ['draft','sent','signed','active','expired'];
  const funnel = stages.map(s => {
    // Bucket by effective status so lapsed 'sent' links land under 'expired'.
    const list = contracts.filter(c => effectiveContractStatus(c) === s);
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
    const overdueP = clientContracts.flatMap(c=>c.payments).some(p => effectiveStatus(p) === 'overdue');
    const pendingP = clientContracts.flatMap(c=>c.payments).filter(p => effectiveStatus(p) === 'pending').sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate))[0];
    let health = 'green';
    if (overdueP) health = 'red';
    else if (!activeC && clientContracts.some(c => effectiveContractStatus(c) === 'sent')) health = 'amber';
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
    downloadFile('﻿' + csv, 'sos-board-export.csv');
    toast.push('Board export downloaded.', 'success');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="font-display text-[var(--navy-deep)]">Dashboard</div>
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
        <div className="sos-pill mb-4">Unsigned Contracts Aging</div>
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
        <div className="sos-pill mb-4">Top Clients by Value</div>
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
    // Filter and display against the EFFECTIVE status so a lapsed 'sent' link
    // reads as 'expired' consistently with its badge.
    if (statusFilter !== 'all' && effectiveContractStatus(c) !== statusFilter) return false;
    const client = clientMap[c.clientId];
    const q = search.toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.contractNumber.toLowerCase().includes(q) || (client && client.companyName.toLowerCase().includes(q));
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="font-display text-[var(--navy-deep)]">Contracts</div>
        {auth.isAdmin && <button onClick={()=>navigate('contracts:new')} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-semibold transition">+ New Contract</button>}
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
                  <td className="py-3 px-4"><Badge status={effectiveContractStatus(c)} /></td>
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

// Services pre-ticked on a NEW contract.
const DEFAULT_SELECTED_SERVICES = ['platform_access', 'match_reports', 'coach_support'];
// The service groups split across the two form sections.
const PLATFORM_GROUPS = ['Core Services', 'Analysis Services'];
const ADDON_GROUPS = ['Recording Services', 'Reporting Services', 'Coaching Support'];

// A/B/C quick-pick packages. Each sets the covered teams + per-team SLA + price.
// Everything remains fully editable after a package is applied.
const ALL_TEAMS = ['U14','U15','U16','U17','U19',"Men's"];
const CONTRACT_PACKAGES = [
  { key:'premium',   label:'Premium',   icon:'🥇', price:15000,
    teamSla: Object.fromEntries(ALL_TEAMS.map(t => [t, 24])) },
  { key:'smart',     label:'Smart',     icon:'🥈', price:12500,
    teamSla: { U14:72, U15:72, U16:72, U17:24, U19:24, "Men's":24 } },
  { key:'essential', label:'Essential', icon:'🥉', price:10000,
    teamSla: Object.fromEntries(ALL_TEAMS.map(t => [t, 72])) },
];
function defaultServicesState() {
  // New contracts pre-fill the platform seats we use as standard (3 Directors,
  // 5 Coaches, Unlimited Players). All editable per contract.
  return Object.fromEntries(SERVICE_CATALOG.map(s => [s.key, { selected: DEFAULT_SELECTED_SERVICES.includes(s.key), qty:s.defaultQty, rate:s.defaultRate, included:false, ...(s.key === 'platform_access' ? { directorSeats:3, coachSeats:5, playerSeats:-1 } : {}) }]));
}

// Local YYYY-MM-DD for a Date (avoids UTC off-by-one from toISOString()).
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
// Today, as YYYY-MM-DD (the default contract start date).
function todayYmd() { return ymd(new Date()); }
// End of the football season a given start date falls in: 30 June of the season
// that ends after that date. A contract starting Jul–Dec 2026 or Jan–Jun 2027
// both map to 30/06/2027. Auto-rolls each year so it never goes stale.
function seasonEndYmd(startStr) {
  const d = startStr ? new Date(startStr) : new Date();
  const y = d.getFullYear();
  // If start is in Jan–Jun, the season ends 30 June of the SAME year; otherwise
  // (Jul–Dec) it ends 30 June of the NEXT year.
  const endYear = d.getMonth() <= 5 ? y : y + 1;
  return `${endYear}-06-30`;
}

// Collapsible form section: a bordered card with a clickable header (title +
// optional summary shown when collapsed) and a body that expands/collapses.
function CollapsibleSection({ title, summary, open, onToggle, children }) {
  return (
    <div className="mt-4 border border-[var(--border)] rounded-lg overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
        <span className="font-heading text-sm text-[var(--navy-deep)]">{title}</span>
        <span className="flex items-center gap-2 min-w-0">
          {!open && summary && <span className="text-xs text-slate-500 truncate">{summary}</span>}
          <span className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// Live breakdown of how the player-funded (Shared / Player-funded) contract
// value is computed, so the figure is never a mystery: club fee + player gross
// − club commission = value. Mirrors commercialValue() exactly.
function CommercialBreakdown({ form }) {
  const cv = commercialValue(form);
  const cur = form.currency;
  const hasInputs = cv.fee && cv.months && cv.players;
  if (!hasInputs && !cv.clubFee) {
    return <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-[var(--border)]">Enter the player fee, months and expected players to compute the contract value.</p>;
  }
  return (
    <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-slate-600 space-y-1">
      {cv.clubFee > 0 && <div className="flex justify-between"><span>Club fixed fee</span><span className="font-data">{fmtMoney(cv.clubFee, cur)}</span></div>}
      <div className="flex justify-between"><span>Player fees ({cv.players} × {fmtMoney(cv.fee, cur)} × {cv.months} mo)</span><span className="font-data">{fmtMoney(cv.playerGross, cur)}</span></div>
      {cv.pct > 0 && <div className="flex justify-between text-slate-500"><span>Less {cv.pct}% club commission</span><span className="font-data">−{fmtMoney(cv.clubShare, cur)}</span></div>}
      <div className="flex justify-between font-semibold text-[var(--navy-deep)] pt-1 border-t border-[var(--border)]"><span>Contract value (projected)</span><span className="font-data">{fmtMoney(cv.value, cur)}</span></div>
      <p className="text-[11px] text-slate-400 pt-1">Projection based on expected enrolment; reconciled against actual player numbers per season.</p>
    </div>
  );
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
    // New-contract defaults (all editable): start = today, end = 30 June of the
    // season it starts in, payment = milestone. Ignored when editing — the load
    // effect below overwrites `form` with the existing contract's saved values.
    startDate: isEdit ? '' : todayYmd(), endDate: isEdit ? '' : seasonEndYmd(todayYmd()),
    paymentType: isEdit ? 'one_time' : 'milestone', paymentTermsDays:30, latePaymentPenalty:1.5,
    governingLaw:'Republic of Cyprus', jurisdiction:'Nicosia, Cyprus', description:'', slaHours:24, specialTerms:'',
    analysisTeams:[], oppMatchFootage:false, oppTeamAnalysis:false, oppPlayerAnalysis:false,
    billingBasis:'services', paymentModel:'club_all', playerMonthlyFee:'', playerMonths:'', kickbackPct:'', minPlayers:'', expectedPlayers:'', clubFixedFee:'', slaBands:[], teamSla:{},
    packageKey:'', packageEdited:false,
  });
  const [titleEdited, setTitleEdited] = useState(isEdit);
  // Which service groups are expanded in the form (collapsible sections).
  // Core Services starts open; the rest collapse until clicked.
  const [openGroups, setOpenGroups] = useState(() => ({ 'Core Services': true }));
  const toggleGroup = (g) => setOpenGroups(o => ({ ...o, [g]: !o[g] }));
  // Which top-level form sections are expanded. New contract: only Services.
  // Editing: smart-expanded after load (see the edit effect below).
  const [openSections, setOpenSections] = useState(() => ({ services: true }));
  const toggleSection = (k) => setOpenSections(o => ({ ...o, [k]: !o[k] }));
  const [installments, setInstallments] = useState([]);
  // Structured special terms: [{ relatesTo, text }]. Serialized to JSON in the
  // special_terms column on save; parsed (legacy plain text supported) on load.
  const [specialTermsList, setSpecialTermsList] = useState([]);
  const addSpecialTerm = () => setSpecialTermsList(l => [...l, { relatesTo: 'General', text: '' }]);
  const updateSpecialTerm = (i, patch) => setSpecialTermsList(l => l.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  const removeSpecialTerm = (i) => setSpecialTermsList(l => l.filter((_, idx) => idx !== i));
  // Guard against a copy-paste leak: a special term that names a DIFFERENT
  // client (e.g. an "AEL" clause pasted into a Pafos contract). Returns the
  // offending name, or '' if the term is clean. Matches whole words only.
  const otherClientNameInTerm = (text) => {
    if (!text) return '';
    const selfName = (clients.find(c => c.id === form.clientId)?.companyName || '').trim().toLowerCase();
    const hay = text.toLowerCase();
    for (const c of clients) {
      const nm = (c.companyName || '').trim();
      if (!nm || nm.toLowerCase() === selfName) continue;
      if (new RegExp(`\\b${nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(hay)) return nm;
    }
    return '';
  };
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  // Once the end date is user-set (typed, or loaded from an existing contract),
  // changing the start date stops auto-rolling the season end.
  const endDateTouched = useRef(false);
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
        analysisTeams: existing.analysisTeams || [],
        oppMatchFootage: !!existing.oppMatchFootage,
        oppTeamAnalysis: !!existing.oppTeamAnalysis,
        oppPlayerAnalysis: !!existing.oppPlayerAnalysis,
        billingBasis: existing.billingBasis || 'services',
        paymentModel: existing.paymentModel || 'club_all',
        playerMonthlyFee: existing.playerMonthlyFee ?? '',
        playerMonths: existing.playerMonths ?? '',
        kickbackPct: existing.kickbackPct ?? '',
        minPlayers: existing.minPlayers ?? '',
        expectedPlayers: existing.expectedPlayers ?? '',
        clubFixedFee: existing.clubFixedFee ?? '',
        slaBands: Array.isArray(existing.slaBands) ? existing.slaBands : [],
        // Expand stored slaBands into the per-team SLA map; fall back to the old
        // single slaHours for teams not covered by a band (legacy contracts).
        teamSla: (() => {
          const map = {};
          (Array.isArray(existing.slaBands) ? existing.slaBands : []).forEach(b => {
            if (b && Array.isArray(b.teams)) b.teams.forEach(t => { map[t] = Number(b.hours) || 72; });
          });
          (existing.analysisTeams || []).forEach(t => { if (!map[t]) map[t] = Number(existing.slaHours) || 72; });
          return map;
        })(),
        // packageKey/packageEdited are UI-only (not persisted). An existing draft
        // is shown on its own merits, with no package badge.
        packageKey: '', packageEdited: false,
      });
      setServices(existing.services ? { ...defaultServicesState(), ...existing.services } : defaultServicesState());
      setSpecialTermsList(parseSpecialTerms(existing.specialTerms));
      if (existing.payments && existing.payments.length) {
        if (existing.paymentType === 'one_time') {
          setOneTimeDate(existing.payments[0].dueDate.slice(0,10));
        } else if (existing.paymentType === 'milestone') {
          setInstallments(existing.payments.map(p => ({ date: p.dueDate.slice(0,10), amount: String(p.amount) })));
          // A saved schedule has deliberate DATES — keep them (don't re-roll from
          // the start date). Amounts still re-split if the user changes the value.
          datesTouched.current = true;
        } else {
          setFirstDueDate(existing.payments[0].dueDate.slice(0,10));
        }
      }
      // Smart-expand: open every section + service group that has content, so
      // editing shows what's filled at a glance.
      const svc = existing.services || {};
      setOpenSections({
        services: true,
        addons: SERVICE_CATALOG.some(s => ADDON_GROUPS.includes(s.group) && svc[s.key]?.selected),
        money: true,
        text: !!(existing.specialTerms && existing.specialTerms.trim()),
      });
      const groupsWithSel = {};
      SERVICE_GROUPS.forEach(g => {
        if (SERVICE_CATALOG.some(s => s.group === g && svc[s.key]?.selected)) groupsWithSel[g] = true;
      });
      setOpenGroups({ 'Core Services': true, ...groupsWithSel });
      // A loaded contract's end date is deliberate — don't let a later start-date
      // tweak silently re-roll it.
      if (existing.endDate) endDateTouched.current = true;
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
    // Adding/removing a row changes the structure -> keep the user's dates.
    // (Amounts still re-split to the contract value on the next value change.)
    datesTouched.current = true;
    setInstallments(rows => [...rows, { date: '', amount: '' }]);
  };
  const updateInstallmentRow = (i, patch) => {
    // Editing a date locks the dates from start-date re-flow. Amounts are NOT
    // locked — the contract value always drives the split (that's what the user
    // wants: change the price, the instalments recalculate).
    if ('date' in patch) datesTouched.current = true;
    setInstallments(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };
  const removeInstallmentRow = (i) => {
    datesTouched.current = true;
    setInstallments(rows => rows.filter((_, idx) => idx !== i));
  };
  const milestoneTotal = installments.reduce((s,r) => s + (Number(r.amount) || 0), 0);

  // Build the standard 3-instalment milestone schedule from a start date + total.
  // Dates are CHAINED: 1st = start + 1 week; 2nd = 2 months after the 1st; 3rd =
  // 2 months after the 2nd. Split 34% / 33% / 33% (last row absorbs rounding so
  // it always sums to the total exactly).
  const buildDefaultMilestones = (startStr, total) => {
    const t = Number(total) || 0;
    const d1 = new Date(startStr); d1.setDate(d1.getDate() + 7);
    const d2 = new Date(d1); d2.setMonth(d2.getMonth() + 2);
    const d3 = new Date(d2); d3.setMonth(d3.getMonth() + 2);
    const i1 = round2(t * 0.34);
    const i2 = round2(t * 0.33);
    const i3 = round2(t - i1 - i2);
    return [
      { date: ymd(d1), amount: String(i1) },
      { date: ymd(d2), amount: String(i2) },
      { date: ymd(d3), amount: String(i3) },
    ];
  };
  // Whether the user has manually edited the milestone AMOUNTS / DATES yet.
  // Tracked separately so the two auto-behaviours are independent: the amounts
  // keep re-splitting to match the contract value until you type an amount, and
  // the dates keep re-flowing from the start date until you pick a date. This is
  // what makes "edit the value -> installments update automatically" work even
  // after the schedule was first pre-filled.
  const datesTouched = useRef(false);
  useEffect(() => {
    if (form.paymentType !== 'milestone') return;
    if (!form.startDate || !(Number(form.value) > 0)) return;
    const gen = buildDefaultMilestones(form.startDate, form.value);
    setInstallments(rows => {
      // First fill (no rows yet): take the whole generated schedule.
      if (!rows.length) return gen;
      // The contract value drives the split: whenever it changes, the amounts
      // ALWAYS re-split across the existing rows (keeping the user's row count).
      // Dates are only re-flowed on the first fill — once shown, we keep whatever
      // dates are there (default or user-picked). Re-split proportionally so a
      // custom split's shape is preserved; even split if the old total was zero.
      const oldTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const newTotal = Number(form.value) || 0;
      let acc = 0;
      return rows.map((r, i) => {
        const share = oldTotal > 0 ? (Number(r.amount) || 0) / oldTotal : 1 / rows.length;
        let amt = i === rows.length - 1 ? round2(newTotal - acc) : round2(newTotal * share);
        acc = round2(acc + amt);
        return {
          date: r.date || gen[i]?.date || '',
          amount: String(amt),
        };
      });
    });
  }, [form.paymentType, form.startDate, form.value]);

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
    // Editing the end date locks it — from then on changing the start date no
    // longer re-rolls the season end (respects the "auto until you touch it" rule).
    if (k === 'endDate') endDateTouched.current = true;
    if (k === 'startDate') {
      setForm(f => {
        const next = { ...f, startDate: v };
        // Re-roll the season end date from the new start, unless the user has
        // set the end date themselves.
        if (!endDateTouched.current && v) next.endDate = seasonEndYmd(v);
        return next;
      });
      return;
    }
    setForm(f => ({ ...f, [k]: v }));
  };

  // Payment model is the primary funding choice. Club-funded = a plain services
  // deal (value = services total). Shared / Player-funded involve player fees
  // (billingBasis 'player_funded'), which the value + clause logic then use.
  const setPaymentModel = (model) => {
    setForm(f => {
      const billingBasis = model === 'club_all' ? 'services' : 'player_funded';
      // Shared and Player-funded both take a MANUALLY entered value, so clear any
      // value carried over from a previous model (e.g. the services total from
      // Club-funded) — a stale figure must never slip through as the agreed fee.
      // Club-funded re-derives its value from the services total via the effect.
      const value = (model === 'club_players' || model === 'players_all') ? '' : f.value;
      return { ...f, paymentModel: model, billingBasis, value };
    });
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
      // A package sets its price via the platform-access rate and pre-selects a
      // set of services. Any manual change to platform-access (rate/selection)
      // or to which services are ticked means the deal no longer matches the
      // package as-picked — flag it "edited" so the label never mis-states it.
      const changesPackagePrice = key === 'platform_access' && ('rate' in patch || 'selected' in patch);
      const changesPackageServices = 'selected' in patch;
      setForm(f => ({
        ...f,
        // Services drive the value only for a services-based deal; for a
        // player-funded deal the value comes from the calculator (Shared) or is
        // entered manually (Player-funded), so never overwrite it here.
        value: f.billingBasis === 'player_funded' ? f.value : String(computeServiceLineItems(next).reduce((sum,i)=>sum+i.amount,0)),
        description: generateDescriptionFromServices(next, docSlaCtx(f)),
        title: titleEdited ? f.title : generateTitle(f.clientId, next),
        packageEdited: (f.packageKey && (changesPackagePrice || changesPackageServices)) ? true : f.packageEdited,
      }));
      return next;
    });
  };

  // Per-team SLA. `analysisTeams` = covered teams; `teamSla` maps team -> hours.
  // Ticking a team adds it at 72h by default; unticking removes it + its SLA.
  const DEFAULT_TEAM_SLA = 72;
  // The SLA context passed to the description/summary generators: derived LIVE
  // from the current teams + per-team SLA (with the single slaHours as a legacy
  // fallback). Centralizing this is what keeps `description` truthful whenever
  // teams / SLAs change — not just when a service is toggled.
  const docSlaCtx = (f) => ({ slaBands: buildSlaBands(f.analysisTeams, f.teamSla), slaHours: f.slaHours });
  // Recompute every field derived from teams/SLA (currently `description`) from
  // an already-updated form object. Any team/SLA mutation funnels through here.
  const withDoc = (f) => ({ ...f, description: generateDescriptionFromServices(services, docSlaCtx(f)) });
  const toggleTeam = (team) => setForm(f => {
    const on = (f.analysisTeams || []).includes(team);
    const teams = on ? (f.analysisTeams || []).filter(t => t !== team) : [...(f.analysisTeams || []), team];
    const teamSla = { ...(f.teamSla || {}) };
    if (on) delete teamSla[team]; else teamSla[team] = teamSla[team] || DEFAULT_TEAM_SLA;
    return withDoc({ ...f, analysisTeams: teams, teamSla, packageEdited: f.packageKey ? true : f.packageEdited });
  });
  const setTeamSla = (team, hours) => setForm(f => withDoc({ ...f, teamSla: { ...(f.teamSla || {}), [team]: hours }, packageEdited: f.packageKey ? true : f.packageEdited }));
  // Apply an A/B/C package: set teams + per-team SLA, and the price (via the
  // platform-access flat rate, so it flows into the value). Fully editable after.
  const applyPackage = (pkg) => {
    const teams = Object.keys(pkg.teamSla);
    const nextServices = { ...services, platform_access: { ...services.platform_access, selected: true, included: false, rate: pkg.price } };
    setServices(nextServices);
    setForm(f => ({ ...f, analysisTeams: teams, teamSla: { ...pkg.teamSla }, packageKey: pkg.key, packageEdited: false,
      description: generateDescriptionFromServices(nextServices, { slaBands: buildSlaBands(teams, pkg.teamSla), slaHours: f.slaHours }) }));
  };
  // Build the slaBands storage [{teams,hours}] from the per-team map, grouping
  // teams that share the same SLA (drives serviceLevelsLines identically).
  const buildSlaBands = (teams, teamSla) => {
    const byHours = {};
    (teams || []).forEach(t => { const h = (teamSla || {})[t] || DEFAULT_TEAM_SLA; (byHours[h] = byHours[h] || []).push(t); });
    return Object.entries(byHours).map(([hours, ts]) => ({ teams: ts, hours: Number(hours) }));
  };

  const lineItems = computeServiceLineItems(services);
  const lineItemsTotal = lineItems.reduce((s,i)=>s+i.amount,0);

  // Commercial Model. Value sources per model (all AUTO-computed now):
  //  - Club-funded (services basis): value = services catalog total.
  //  - Shared: value = club fixed fee + (player fee x months x expected players
  //    x (1 - kickback%)). The club fee is kept in full; the kickback reduces the
  //    player revenue only.
  //  - Player-funded: value = player fee x months x expected players x (1 - kickback%).
  //  All are projections reconciled against actual enrolment (stated in the clause).
  const commercialProjection = form.billingBasis === 'player_funded' ? commercialValue(form) : null;
  useEffect(() => {
    if (form.billingBasis === 'services') {
      const total = String(lineItemsTotal);
      setForm(f => (f.value === total ? f : { ...f, value: total }));
    } else if (commercialProjection) {
      const v = String(commercialProjection.value);
      setForm(f => (f.value === v ? f : { ...f, value: v }));
    }
  }, [form.billingBasis, lineItemsTotal, commercialProjection?.value]);

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required.';
    if (!form.clientId) e.clientId = 'Select a client.';
    // The value is computed for every model now. A non-positive computed value
    // for a player-funded deal means the projection inputs are missing.
    if (!form.value || Number(form.value) <= 0) {
      e.value = form.billingBasis === 'player_funded'
        ? 'Enter the player fee, months and expected players to compute a value.'
        : 'Enter a positive value.';
    } else if (!/^\d+(\.\d{1,2})?$/.test(String(form.value))) {
      e.value = 'Max 2 decimal places.';
    }
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
    // Copy-paste leak guard: if any special term names a different client,
    // make the user confirm before saving (prevents an "AEL" clause reaching
    // a Pafos contract).
    const leak = specialTermsList
      .map(t => otherClientNameInTerm(t.text))
      .find(Boolean);
    if (leak) {
      const self = clients.find(c => c.id === form.clientId)?.companyName || 'this client';
      if (!window.confirm(`A special term names "${leak}", which is a different client — but this contract is for ${self}.\n\nSave anyway?`)) return;
    }
    setBusy(true);
    try {
      const client = clients.find(c => c.id === form.clientId);
      // Serialize the structured special terms (drop empty rows) to JSON, or ''.
      const cleanTerms = specialTermsList.filter(t => t.text && t.text.trim());
      const specialTerms = cleanTerms.length ? JSON.stringify(cleanTerms) : '';
      // Derive the stored SLA bands from the per-team SLA map, and keep the
      // legacy single slaHours + the description in sync with them at save time
      // (final guard so a saved contract can never carry a stale 24h or an
      // out-of-date services description, whatever edit path was used).
      const slaBands = buildSlaBands(form.analysisTeams, form.teamSla);
      const slaHours = slaBands.length
        ? Math.min(...slaBands.map(b => Number(b.hours)))
        : (Number(form.slaHours) || 0);
      const description = generateDescriptionFromServices(services, { slaBands, slaHours });
      const schedule = form.paymentType === 'one_time'
        ? [{ date: oneTimeDate, amount: Number(form.value) }]
        : form.paymentType === 'milestone'
        ? installments.map(r => ({ date: r.date, amount: Number(r.amount) }))
        : recurringInstallments();

      let contract;
      if (isEdit) {
        contract = await contractService.update(editContractId, {
          ...form,
          specialTerms,
          slaBands,
          slaHours,
          description,
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
          specialTerms,
          slaBands,
          slaHours,
          description,
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

  // Render one service group (collapsible) + its group-specific extras
  // (teams/SLA under Core Services, opponent access under Analysis Services).
  const renderServiceGroup = (group) => {
    const groupServices = SERVICE_CATALOG.filter(s => s.group === group);
    const selectedCount = groupServices.filter(s => services[s.key]?.selected).length;
    const open = !!openGroups[group];
    return (
      <div key={group} className="mb-2 last:mb-0 border border-[var(--border)] rounded-lg overflow-hidden">
        <button type="button" onClick={()=>toggleGroup(group)} className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition text-left">
          <span className="text-xs font-semibold text-[var(--navy-deep)] uppercase tracking-wide">{group}</span>
          <span className="flex items-center gap-2">
            {selectedCount > 0 && <span className="text-[11px] font-medium text-white bg-[var(--navy-deep)] rounded-full px-2 py-0.5">{selectedCount} selected</span>}
            <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
          </span>
        </button>
        {open && (
        <div className="p-3">
        <div className="space-y-2">
          {groupServices.map(s => {
            const svc = services[s.key];
            return (
              <div key={s.key} className="py-1.5 border-b border-[var(--border)] last:border-0">
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={svc.selected} onChange={e=>toggleService(s.key, { selected: e.target.checked })} className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{s.label}</div>
                    <div className="text-xs text-slate-400">{SERVICE_UNIT_LABELS[s.unit]}</div>
                  </div>
                  {(s.unit === 'per_match' || s.unit === 'per_unit') && svc.selected && (() => { const needsQty = !svc.included && (Number(svc.qty) || 0) <= 0; return (
                    <div className="shrink-0 text-right">
                      <input type="number" min="0" value={svc.qty} onChange={e=>toggleService(s.key, { qty: Number(e.target.value) })} className={`w-20 px-2 py-1 text-sm border rounded-lg ${needsQty ? 'border-amber-400 bg-amber-50' : 'border-[var(--border)]'}`} placeholder="Qty" />
                      {needsQty && <div className="text-[10px] text-amber-600 mt-0.5">set a quantity</div>}
                    </div>
                  ); })()}
                  {svc.selected && s.unit !== 'included' && (
                    <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0 cursor-pointer" title="Include this service at no charge (its value is still shown to the client, struck through)">
                      <input type="checkbox" checked={!!svc.included} onChange={e=>toggleService(s.key, { included: e.target.checked })} />
                      Included
                    </label>
                  )}
                  {svc.selected && s.unit !== 'included' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-slate-400">{CURRENCY_SYMBOL[form.currency]}</span>
                      <input type="number" min="0" step="0.01" value={svc.rate} onChange={e=>toggleService(s.key, { rate: Number(e.target.value) })} className="w-20 px-2 py-1 text-sm border border-[var(--border)] rounded-lg text-right" placeholder="Rate" />
                    </div>
                  )}
                  {svc.selected && s.unit !== 'included' && (() => { const lp = s.unit==='flat'?svc.rate:svc.rate*svc.qty; return (
                    <div className="w-28 text-right text-sm font-data">
                      {svc.included
                        ? (lp > 0
                            ? <><span className="line-through text-slate-400">{fmtMoney(lp, form.currency)}</span> <span className="text-emerald-600">Incl.</span></>
                            : <span className="text-emerald-600">Included</span>)
                        : fmtMoney(lp, form.currency)}
                    </div>
                  ); })()}
                </div>
                {s.key === 'platform_access' && svc.selected && (
                  <div className="mt-3 ml-7 rounded-lg border border-[var(--navy-deep)] overflow-hidden">
                    <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white" style={{ background:'var(--navy-deep)' }}>Platform Access</div>
                    <div className="flex flex-wrap gap-3 p-3 bg-slate-50/60">
                      {[
                        { field:'directorSeats', label:'Directors' },
                        { field:'coachSeats', label:'Coaches' },
                        { field:'playerSeats', label:'Players' },
                      ].map(({ field, label }) => {
                        const isUnlimited = svc[field] === UNLIMITED_SEATS;
                        return (
                          <div key={field} className="flex flex-col gap-1 bg-white border border-[var(--border)] rounded-lg px-3 py-2 min-w-[110px]">
                            <span className="text-xs font-medium text-[var(--navy-deep)]">{label}</span>
                            <input
                              type="number" min="0" disabled={isUnlimited}
                              value={isUnlimited ? '' : svc[field]}
                              onChange={e=>toggleService(s.key, { [field]: Number(e.target.value) })}
                              className="w-full px-2 py-1 text-sm border border-[var(--border)] rounded-lg disabled:bg-slate-100 disabled:text-slate-400"
                              placeholder={isUnlimited ? '∞ Unlimited' : '0'}
                            />
                            <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                              <input type="checkbox" checked={isUnlimited} onChange={e=>toggleService(s.key, { [field]: e.target.checked ? UNLIMITED_SEATS : 0 })} />
                              Unlimited
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {group === 'Core Services' && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
            {/* A/B/C package quick-pick — fills teams + SLA + price in one click. */}
            <div>
              <div className="text-sm font-medium text-slate-600 mb-1">Quick package {form.packageKey && <span className="text-xs font-normal text-slate-400">— {CONTRACT_PACKAGES.find(p=>p.key===form.packageKey)?.label}{form.packageEdited ? ' (edited)' : ''} selected</span>}</div>
              <p className="text-xs text-slate-400 mb-2">Pick a package to fill the teams, SLAs and price in one click — then edit anything below.</p>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_PACKAGES.map(pkg => {
                  const active = form.packageKey === pkg.key && !form.packageEdited;
                  return (
                    <button type="button" key={pkg.key} onClick={()=>applyPackage(pkg)}
                      className={`px-3 py-2 rounded-lg text-sm border transition text-left ${active ? 'bg-[var(--navy-deep)] text-white border-[var(--navy-deep)]' : 'bg-white text-slate-700 border-[var(--border)] hover:border-blue-300'}`}>
                      <div className="font-medium">{pkg.icon} {pkg.label}</div>
                      <div className={`text-xs ${active ? 'text-slate-200' : 'text-slate-400'}`}>{fmtMoney(pkg.price, form.currency)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--navy-deep)] overflow-hidden">
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white" style={{ background:'var(--navy-deep)' }}>Teams Analysed &amp; Delivery SLA</div>
              <div className="p-3 bg-slate-50/60">
                <p className="text-xs text-slate-400 mb-2">Tick each team analysed and set how fast its match analysis is delivered. Covers League competition matches for the contract season.</p>
                <div className="space-y-1.5">
                  {['U14','U15','U16','U17','U19',"Men's"].map(team => {
                    const on = (form.analysisTeams || []).includes(team);
                    const hrs = (form.teamSla || {})[team] || 72;
                    return (
                      <div key={team} className="flex items-center gap-3">
                        <button type="button" onClick={()=>toggleTeam(team)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition w-24 text-left ${on ? 'bg-[var(--navy-deep)] text-white border-[var(--navy-deep)]' : 'bg-white text-slate-600 border-[var(--border)] hover:border-blue-300'}`}>
                          {on ? '✓ ' : ''}{team}
                        </button>
                        {on && (
                          <div className="flex items-center gap-2">
                            <select value={hrs} onChange={e=>setTeamSla(team, Number(e.target.value))} className="px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg bg-white font-medium">
                              {[24,48,72].map(h => <option key={h} value={h}>{h}h</option>)}
                            </select>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${hrs===24 ? 'bg-emerald-100 text-emerald-700' : hrs===48 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>{hrs}h SLA</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
        {group === 'Analysis Services' && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="text-sm font-medium text-slate-600 mb-2">Opponent analysis access</div>
            <div className="space-y-2">
              {[['oppMatchFootage','Opponent match footage'],['oppTeamAnalysis','Opponent team analysis'],['oppPlayerAnalysis','Opponent player analysis']].map(([key,label]) => (
                <label key={key} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={!!form[key]} onChange={e=>set(key, e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}
        </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="font-display mb-6 text-[var(--navy-deep)]">{isEdit ? 'Edit Contract' : 'New Contract'}</div>

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

        <CollapsibleSection title="Platform & Analysis" open={openSections.services} onToggle={()=>toggleSection('services')} summary={`${lineItems.filter(i=>PLATFORM_GROUPS.includes(i.group)).length} selected`}>
        <p className="text-xs text-slate-500 mb-4">The core of the deal — platform access, the teams analysed and their delivery SLA, and match analysis. Mark a service "Included" to provide it at no charge (its value is still shown, struck through, but not added to the total).</p>
        {PLATFORM_GROUPS.map(group => renderServiceGroup(group))}
        </CollapsibleSection>

        <CollapsibleSection title="Add-on Services" open={openSections.addons} onToggle={()=>toggleSection('addons')} summary={`${lineItems.filter(i=>ADDON_GROUPS.includes(i.group)).length} selected`}>
        <p className="text-xs text-slate-500 mb-4">Optional extras — recording, physical data, broadcasting and additional reports. Tick each one the client is taking and set its quantity and price.</p>
        {ADDON_GROUPS.map(group => renderServiceGroup(group))}
        <div className="flex justify-between pt-3 border-t border-[var(--border)] font-heading text-base">
          <span>Total (chargeable)</span>
          <span className="font-data">{fmtMoney(lineItemsTotal, form.currency)}</span>
        </div>
        </CollapsibleSection>

        {/* --- Commercial Model: how the deal is funded. --------------------- */}
        <CollapsibleSection title="Commercial & Payment" open={openSections.money} onToggle={()=>toggleSection('money')} summary={`${(PAYMENT_MODEL_LABELS[form.paymentModel] || 'Club-funded').split(' — ')[0]} · ${fmtMoney(form.value || 0, form.currency)}`}>
        <div className="font-heading text-sm mb-3 text-[var(--navy-deep)]">Funding</div>
        <p className="text-xs text-slate-400 mb-3">How is this deal funded? The services above describe what the Client gets; this sets who pays. For Shared and Player-funded deals, the contract value is entered manually below (the player numbers aren't known in advance, so they're stated as terms, not computed).</p>
        <div className="space-y-1.5 mb-3">
          {[['club_all','Club-funded — the Client pays the full fee'],['club_players','Shared — a fixed amount is agreed with the Client; players fund the remainder'],['players_all','Player-funded — fees are collected directly from players']].map(([val,label]) => (
            <label key={val} className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input type="radio" name="paymentModel" checked={form.paymentModel===val} onChange={()=>setPaymentModel(val)} className="mt-0.5" />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {form.paymentModel === 'club_players' && (
          <div className="rounded-lg border border-[var(--border)] p-4 mb-2 bg-slate-50/60">
            <p className="text-xs text-slate-500 mb-3">The contract value is computed as the <strong>club fixed fee</strong> plus the projected player contribution (fee × months × expected players), net of the club commission. It reconciles against actual enrolment.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label={`Club fixed fee (${CURRENCY_SYMBOL[form.currency]})`}><input type="number" min="0" step="0.01" value={form.clubFixedFee} onChange={e=>set('clubFixedFee', e.target.value)} className={inputCls(false)} placeholder="5000" /></Field>
              <Field label={`Player fee / month (${CURRENCY_SYMBOL[form.currency]})`}><input type="number" min="0" step="0.01" value={form.playerMonthlyFee} onChange={e=>set('playerMonthlyFee', e.target.value)} className={inputCls(false)} placeholder="15" /></Field>
              <Field label="Months"><input type="number" min="0" value={form.playerMonths} onChange={e=>set('playerMonths', e.target.value)} className={inputCls(false)} placeholder="10" /></Field>
              <Field label="Expected players"><input type="number" min="0" value={form.expectedPlayers} onChange={e=>set('expectedPlayers', e.target.value)} className={inputCls(false)} placeholder="15" /></Field>
              <Field label="Minimum players"><input type="number" min="0" value={form.minPlayers} onChange={e=>set('minPlayers', e.target.value)} className={inputCls(false)} placeholder="optional" /></Field>
              <Field label="Club commission %"><input type="number" min="0" max="100" step="0.1" value={form.kickbackPct} onChange={e=>set('kickbackPct', e.target.value)} className={inputCls(false)} placeholder="25" /></Field>
            </div>
            <CommercialBreakdown form={form} />
          </div>
        )}
        {form.paymentModel === 'players_all' && (
          <div className="rounded-lg border border-[var(--border)] p-4 mb-2 bg-slate-50/60">
            <p className="text-xs text-slate-500 mb-3">Players pay the Service Provider directly. The contract value is the projected player contribution (fee × months × expected players), net of the club commission — reconciled against actual enrolment.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label={`Player fee / month (${CURRENCY_SYMBOL[form.currency]})`}><input type="number" min="0" step="0.01" value={form.playerMonthlyFee} onChange={e=>set('playerMonthlyFee', e.target.value)} className={inputCls(false)} placeholder="15" /></Field>
              <Field label="Months"><input type="number" min="0" value={form.playerMonths} onChange={e=>set('playerMonths', e.target.value)} className={inputCls(false)} placeholder="10" /></Field>
              <Field label="Expected players"><input type="number" min="0" value={form.expectedPlayers} onChange={e=>set('expectedPlayers', e.target.value)} className={inputCls(false)} placeholder="20" /></Field>
              <Field label="Minimum players"><input type="number" min="0" value={form.minPlayers} onChange={e=>set('minPlayers', e.target.value)} className={inputCls(false)} placeholder="optional" /></Field>
              <Field label="Club commission %"><input type="number" min="0" max="100" step="0.1" value={form.kickbackPct} onChange={e=>set('kickbackPct', e.target.value)} className={inputCls(false)} placeholder="25" /></Field>
            </div>
            <CommercialBreakdown form={form} />
          </div>
        )}

        <div className="font-heading text-sm mt-6 mb-3 pt-5 border-t border-[var(--border)] text-[var(--navy-deep)]">Value & Dates</div>
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
        <p className="text-xs text-slate-400 -mt-3 mb-4">{form.paymentModel === 'club_players' ? 'Computed automatically: club fixed fee + projected player revenue, net of the club commission (see breakdown above).' : form.paymentModel === 'players_all' ? 'Computed automatically: projected player revenue, net of the club commission (see breakdown above).' : 'Value is computed automatically from the services above.'}</p>
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

        <div className="font-heading text-sm mt-6 mb-3 pt-5 border-t border-[var(--border)] text-[var(--navy-deep)]">Payment Schedule</div>
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
        </CollapsibleSection>

        <CollapsibleSection title="Special Terms" open={openSections.text} onToggle={()=>toggleSection('text')} summary={specialTermsList.filter(t=>t.text&&t.text.trim()).length ? `${specialTermsList.filter(t=>t.text&&t.text.trim()).length} special term(s)` : 'None'}>
        <div className="mb-2">
          <p className="text-xs text-slate-400 mb-3">Add one-off terms specific to this club (optional). Link a term to the clause it modifies (e.g. Fees &amp; Payment) so it reads clearly in the signed contract, or leave it "General".</p>
          <div className="space-y-3">
            {specialTermsList.map((term, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-3 bg-slate-50/60">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 shrink-0">Relates to</span>
                  <select value={term.relatesTo || 'General'} onChange={e=>updateSpecialTerm(i, { relatesTo: e.target.value })} className="px-2 py-1 text-sm border border-[var(--border)] rounded-lg bg-white text-slate-600 flex-1">
                    {SPECIAL_TERM_CLAUSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={()=>removeSpecialTerm(i)} className="text-slate-400 hover:text-red-500 px-2 shrink-0" title="Remove term">✕</button>
                </div>
                <textarea value={term.text} onChange={e=>updateSpecialTerm(i, { text: e.target.value })} rows={2} className={inputCls(false)} placeholder="e.g. The club commission shall be settled quarterly rather than per season." />
                {otherClientNameInTerm(term.text) && (
                  <p className="mt-1.5 text-xs text-amber-600 flex items-start gap-1">
                    <span aria-hidden>⚠</span>
                    <span>This term names <strong>{otherClientNameInTerm(term.text)}</strong> — a different client. Did you mean {clients.find(c=>c.id===form.clientId)?.companyName || 'this client'}?</span>
                  </p>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addSpecialTerm} className="text-sm text-[var(--blue-primary)] hover:underline mt-2">+ Add Special Term</button>
        </div>
        </CollapsibleSection>

        <div className="flex justify-end gap-3 pt-4">
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
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [certificate, setCertificate] = useState(null);
  // Inline invoice-ref editing: { id, value } while a row is being edited.
  const [editingRef, setEditingRef] = useState(null);
  const [savingRef, setSavingRef] = useState(false);
  // The signing link captured from the last send/resend, so it can be copied
  // and shared (e.g. WhatsApp) alongside the email. Cleared on recall to draft.
  const [signLink, setSignLink] = useState('');
  const [copyingLink, setCopyingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  // Shows the "sent — here's the link" modal immediately after a send/resend.
  const [sentLinkModal, setSentLinkModal] = useState(null); // { url } | null

  const load = useCallback(async () => {
    const c = await contractService.getById(contractId);
    setContract(c);
    if (c) setClient(await clientService.getById(c.clientId));
    // Load the Certificate of Completion if the contract has been signed.
    if (c && c.signedAt) {
      try { setCertificate(await contractService.getCertificate(contractId)); }
      catch (e) { setCertificate(null); }
    } else {
      setCertificate(null);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  // Save an edited invoice reference (accountingRef) on a payment, and log it.
  const saveInvoiceRef = async (payment) => {
    const next = (editingRef?.value || '').trim() || null;
    const prev = payment.accountingRef || null;
    if (next === prev) { setEditingRef(null); return; }
    setSavingRef(true);
    try {
      await paymentService.update(payment.id, { accountingRef: next });
      await contractService.addAuditEntry(contract.id, {
        type: 'payment',
        message: `Invoice reference for "${payment.description}" ${prev ? `changed from ${prev} to ${next || '—'}` : `set to ${next}`}`,
        by: auth.user?.id ?? null,
      });
      setEditingRef(null);
      await load();
    } catch (err) {
      toast.push(err.message || 'Could not update the invoice reference.', 'error');
    } finally {
      setSavingRef(false);
    }
  };

  if (!contract) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const sendContract = async () => {
    // PRIMARY send path: create a server-backed signing request. The Edge
    // Function freezes a document snapshot, sets the contract status to 'sent',
    // and emails the client a real ?req= signing link. The portable ?sign= link
    // (rendered below once status is 'sent') remains as a secondary fallback.
    setShowSendModal(false);
    // Guard: the VAT lines + bank box on the document are driven by the client's
    // country (CY → 19% VAT). If the client has no country, the frozen snapshot
    // captures a VAT-less review copy that then diverges from the signed copy
    // once the details are confirmed at signing. Block the send so the review
    // and signed documents are always identical.
    if (!client?.country) {
      toast.push('Set the client’s country before sending — it decides VAT (Cyprus = 19%). Edit the client, add the country, then send.', 'error');
      return;
    }
    try {
      const origin = window.location.origin;
      const res = await signingService.createSigningRequest(contract.id, origin);
      if (res?.signUrl) { setSignLink(res.signUrl); setSentLinkModal({ url: res.signUrl }); }
      toast.push(`Signing request sent to ${client.contactEmail}.`, 'success');
      load(); // contract is now status 'sent'
    } catch (err) {
      toast.push(err.message || 'Could not send the signing request.', 'error');
    }
  };

  const resendContract = async () => {
    if (!client?.country) {
      toast.push('Set the client’s country before sending — it decides VAT (Cyprus = 19%).', 'error');
      return;
    }
    try {
      const res = await signingService.createSigningRequest(contract.id, window.location.origin);
      if (res?.signUrl) { setSignLink(res.signUrl); setSentLinkModal({ url: res.signUrl }); }
      toast.push('New signing link sent.', 'success');
      load();
    } catch (err) {
      toast.push(err.message || 'Could not send a new signing link.', 'error');
    }
  };

  // Copy the client's signing link to the clipboard for sharing (WhatsApp, SMS).
  // If we don't already have the link in memory (e.g. the contract was sent in a
  // previous session), issue a fresh link and copy that — a new link also emails
  // the client, which is the safe, auditable behaviour.
  const copySignLink = async () => {
    setCopyingLink(true);
    try {
      let url = signLink;
      if (!url) {
        const res = await signingService.createSigningRequest(contract.id, window.location.origin);
        url = res?.signUrl || '';
        if (url) setSignLink(url);
      }
      if (!url) throw new Error('Could not generate a signing link.');
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
      toast.push('Signing link copied — paste it into WhatsApp or a message.', 'success');
    } catch (err) {
      toast.push(err.message || 'Could not copy the signing link.', 'error');
    } finally {
      setCopyingLink(false);
    }
  };

  const reviseContract = async () => {
    try {
      await contractService.updateStatus(contract.id, 'draft');
      setSignLink('');
      toast.push('Contract recalled to draft — you can now edit and resend.', 'success');
      load();
    } catch (err) {
      toast.push(err.message || 'Could not recall this contract to draft.', 'error');
    }
  };

  const deleteContract = async () => {
    try {
      await contractService.delete(contract.id);
      toast.push('Contract deleted.', 'success');
      navigate('contracts:all');
    } catch (err) {
      // Server-side trigger blocks deleting signed/active contracts.
      toast.push(err.message || 'Could not delete this contract.', 'error');
      setShowDeleteModal(false);
    }
  };

  const cancelContract = async () => {
    try {
      await contractService.updateStatus(contract.id, 'cancelled');
      toast.push('Contract cancelled. The signed record and evidence are retained.', 'success');
      setShowCancelModal(false);
      load();
    } catch (err) {
      toast.push(err.message || 'Could not cancel this contract.', 'error');
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <button onClick={()=>navigate('contracts:all')} className="text-sm text-slate-500 hover:text-slate-700 mb-4">← All Contracts</button>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="font-display text-[var(--navy-deep)]">{contract.title}</div>
          <div className="text-sm text-slate-400 font-data mt-1">{contract.contractNumber} · v{contract.version}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge status={contract.status} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 no-print">
        <button onClick={()=>navigate('document:'+contract.id)} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">View Contract Document</button>
        {auth.isAdmin && contract.status === 'draft' && <button onClick={()=>navigate('contracts:edit:'+contract.id)} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">Edit</button>}
        {auth.isAdmin && contract.status === 'draft' && <button onClick={()=>setShowSendModal(true)} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-medium transition">Send for Signature</button>}
        {auth.isAdmin && (contract.status === 'sent' || contract.status === 'expired' || contract.status === 'declined') && <button onClick={resendContract} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Resend / New link</button>}
        {auth.isAdmin && (contract.status === 'sent' || contract.status === 'expired' || contract.status === 'declined') && <button onClick={reviseContract} className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">Revise (recall to draft)</button>}
        {auth.isAdmin && (contract.status === 'signed' || contract.status === 'active') && <button onClick={()=>setShowPaymentModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">+ Add Payment Milestone</button>}
        {/* Signed/active contracts are cancelled (soft), not deleted — the
            signature evidence must be retained. Other statuses can be deleted. */}
        {auth.isAdmin && (contract.status === 'signed' || contract.status === 'active') && contract.status !== 'cancelled' && <button onClick={()=>setShowCancelModal(true)} className="px-4 py-2 border border-amber-200 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-50 transition">Cancel Contract</button>}
        {auth.isAdmin && contract.status !== 'signed' && contract.status !== 'active' && <button onClick={()=>setShowDeleteModal(true)} className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">Delete</button>}
      </div>

      {auth.isAdmin && contract.status === 'sent' && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 mb-6 no-print">
          <div className="font-heading text-base mb-1 text-amber-800">📧 Sent for signature — awaiting the client</div>
          <p className="text-sm text-amber-700">A signing request has been emailed to <strong>{client?.contactEmail}</strong>. The client will verify their email with a one-time code, review the agreement, and sign. You'll be notified by email the moment they sign, and this contract will move to <strong>Active</strong> automatically.</p>
          {/* Copyable signing link — share via WhatsApp / message as well as email. */}
          <div className="mt-3 pt-3 border-t border-amber-200">
            <div className="text-xs font-medium text-amber-800 mb-1.5">Share the signing link directly</div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={copySignLink} disabled={copyingLink} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700 transition disabled:opacity-50">
                {copyingLink ? 'Preparing…' : linkCopied ? '✓ Copied' : '🔗 Copy signing link'}
              </button>
              {signLink && <span className="text-xs text-amber-700 font-mono truncate max-w-full sm:max-w-md" title={signLink}>{signLink}</span>}
            </div>
            <p className="text-[11px] text-amber-600 mt-1.5">The link is unique to this client and asks them to verify their email before signing.{!signLink && ' Generating it here also re-emails the link to the client.'}</p>
          </div>
          <p className="text-xs text-amber-600 mt-3">Sent to the wrong address? Update the client's email under Clients, then use “Resend / New link” above.</p>
        </div>
      )}

      {auth.isAdmin && contract.status === 'declined' && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-5 mb-6 no-print">
          <div className="font-heading text-base mb-1 text-red-800">✋ This contract was declined by the client.</div>
          {(() => {
            const declinedEntry = contract.auditLog.slice().reverse().find(a => a.type === 'declined');
            return declinedEntry
              ? <p className="text-sm text-red-700">{declinedEntry.message}</p>
              : <p className="text-sm text-red-700">The client declined this contract.</p>;
          })()}
          <p className="text-xs text-red-600 mt-2">Use <strong>Resend / New link</strong> to send a fresh signing link, or <strong>Revise (recall to draft)</strong> to edit the contract before resending.</p>
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
          {(() => {
            const bullets = contract.services ? summarizeAgreement(contract) : [];
            if (!bullets.length) return null;
            return (
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">What's included</div>
                <ul className="text-sm text-slate-600 space-y-1">
                  {bullets.map((b, i) => (
                    <li key={i} className="flex gap-2"><span className="text-[var(--cyan)] shrink-0">•</span><span>{b}</span></li>
                  ))}
                </ul>
              </div>
            );
          })()}
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
                  {/* Both hashes are the full canonical document hash (send-time vs
                      executed). They are equal when nothing changed; they differ
                      ONLY because the signer completed their own party details
                      (company/VAT/address) on the signing page — a legitimate,
                      expected act, not tampering. So a difference reads as
                      "Confirmed on signing", never an alarming mismatch. */}
                  <div className="flex justify-between"><dt className="text-slate-500">Document Integrity</dt><dd className="text-emerald-600">{contract.documentHashBefore === contract.documentHashAfter ? '✓ Verified' : '✓ Verified (details confirmed on signing)'}</dd></div>
                </React.Fragment>
              ) : (
                <div className="flex justify-between"><dt className="text-slate-500">Method</dt><dd className="text-slate-500 text-xs">Recorded manually (paper/offline signature)</dd></div>
              )}
              {certificate && certificate.downloadUrl && (
                <a href={certificate.downloadUrl} target="_blank" rel="noopener noreferrer"
                   className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium sos-btn-cyan"
                   style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>
                  ⬇ Download Certificate of Completion (PDF)
                </a>
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
                    <td className="py-2.5 pr-4 font-data text-xs">
                      {editingRef?.id === p.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input autoFocus value={editingRef.value} onChange={e=>setEditingRef({ id:p.id, value:e.target.value })}
                            onKeyDown={e=>{ if(e.key==='Enter') saveInvoiceRef(p); if(e.key==='Escape') setEditingRef(null); }}
                            className="w-28 px-2 py-1 text-xs border border-[var(--border)] rounded" placeholder="Invoice #" />
                          <button disabled={savingRef} onClick={()=>saveInvoiceRef(p)} className="text-emerald-600 hover:underline">Save</button>
                          <button onClick={()=>setEditingRef(null)} className="text-slate-400 hover:underline">Cancel</button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {p.accountingRef || <span className="text-slate-400">—</span>}
                          {auth.isAdmin && <button onClick={()=>setEditingRef({ id:p.id, value:p.accountingRef||'' })} className="no-print text-blue-600 hover:underline text-[11px]">{p.accountingRef ? 'Edit' : 'Add'}</button>}
                        </span>
                      )}
                    </td>
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
      <ConfirmModal open={showDeleteModal} onClose={()=>setShowDeleteModal(false)} onConfirm={deleteContract} title="Delete Contract"
        message={`This will permanently delete "${contract.title}". It has not been signed, but this cannot be undone.`}
        confirmLabel="Delete" danger />
      <ConfirmModal open={showCancelModal} onClose={()=>setShowCancelModal(false)} onConfirm={cancelContract} title="Cancel Contract"
        message={`This marks "${contract.title}" as cancelled and removes it from active views. The signed record, signature evidence, and Certificate of Completion are RETAINED (a signed agreement cannot be deleted). Continue?`}
        confirmLabel="Cancel contract" danger />
      {showPaymentModal && <AddPaymentModal contract={contract} client={client} onClose={()=>setShowPaymentModal(false)} onDone={()=>{ setShowPaymentModal(false); load(); }} />}
      {showMarkPaidPayment && <MarkPaidModal contract={contract} payment={showMarkPaidPayment} onClose={()=>setShowMarkPaidPayment(null)} onDone={()=>{ setShowMarkPaidPayment(null); load(); }} />}
      {sentLinkModal && <SentLinkModal url={sentLinkModal.url} clientName={client?.contactName} clientEmail={client?.contactEmail} onClose={()=>setSentLinkModal(null)} />}
    </div>
  );
}

// Shown right after a contract is sent: confirms the email went out and offers
// the signing link with a one-click Copy so it can also be shared via WhatsApp.
function SentLinkModal({ url, clientName, clientEmail, onClose }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.push('Signing link copied — paste it into WhatsApp or a message.', 'success');
    } catch (_) {
      toast.push('Could not copy automatically — select and copy the link below.', 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title="✅ Sent for signature" footer={
      <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Done</button>
    }>
      <p className="text-sm text-slate-600 mb-1">The signing request was emailed to <strong>{clientName || 'the client'}</strong>{clientEmail ? ` (${clientEmail})` : ''}, with a copy to your info@ inbox.</p>
      <p className="text-sm text-slate-600 mb-4">Want to send it another way too? Copy the link and share it via WhatsApp or message:</p>
      <div className="flex items-center gap-2 bg-slate-50 border border-[var(--border)] rounded-lg p-2">
        <input readOnly value={url} onFocus={e=>e.target.select()} className="flex-1 bg-transparent text-xs font-mono text-slate-600 outline-none min-w-0" />
        <button onClick={copy} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700 transition">
          {copied ? '✓ Copied' : '🔗 Copy'}
        </button>
      </div>
      <p className="text-[11px] text-slate-400 mt-2">The link is unique to this client and asks them to verify their email before signing.</p>
    </Modal>
  );
}

const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_LOGO_BYTES = 1 * 1024 * 1024;

// Normalize an uploaded logo file to a PNG data URL. Browsers accept WEBP/GIF/
// SVG via <input accept="image/*">, but the PDF generators (pdf-lib / jsPDF)
// can only embed PNG or JPEG — a WEBP logo silently falls back to text in the
// sent/signed PDFs. Rendering the image onto a canvas and exporting PNG makes
// every logo embeddable everywhere. Falls back to the original data URL if the
// browser can't decode it (very rare).
function fileToPngDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image.'));
    reader.onload = () => {
      const src = reader.result;
      const img = new Image();
      img.onload = () => {
        try {
          // Cap dimensions so the stored PNG stays lightweight (logos are small).
          const maxDim = 600;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const s = maxDim / Math.max(width, height);
            width = Math.round(width * s); height = Math.round(height * s);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png'));
        } catch (_) {
          resolve(src); // keep the original if canvas export fails
        }
      };
      img.onerror = () => resolve(src); // e.g. SVG the canvas can't rasterize — keep original
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

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
      // An uploaded signed contract is a live, in-force deal — activate it.
      // (We use 'active', not 'signed': 'signed' implies the platform's
      // cryptographic evidence trail, which an offline PDF doesn't carry.)
      // Skip if already active/signed so re-uploading a replacement is a no-op.
      if (contract.status !== 'active' && contract.status !== 'signed') {
        await contractService.updateStatus(contract.id, 'active');
      }
      await contractService.addAuditEntry(contract.id, { type:'document', message:`Signed document uploaded (${file.name})`, by: auth.user.id });
      toast.push('Signed contract uploaded — marked active.', 'success');
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

// International-standard signature block: separate labelled lines for
// Signature, Name, Title, and Date. When signed, the captured values are shown
// above each line; when blank, empty lines are provided for wet-ink signing.
function SignatureLines({ signature, signatureImage, name, title, date }) {
  const Row = ({ label, value, tall, image }) => (
    <div className="mb-4">
      <div className={`${tall ? 'h-28' : 'h-6'} border-b border-slate-400 flex items-end pb-1`}>
        {image ? <img src={image} alt="signature" className="max-h-[104px] max-w-full w-auto object-contain" style={{ filter:'contrast(1.35) saturate(1.1)' }} />
          : value ? <span className={label === 'Signature' ? 'italic font-semibold text-slate-900 text-2xl' : 'text-slate-800'}>{value}</span> : null}
      </div>
      <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide">{label}</div>
    </div>
  );
  return (
    <div>
      <Row label="Signature" value={signature} image={signatureImage} tall />
      <Row label="Name" value={name} />
      <Row label="Title" value={title} />
      <Row label="Date" value={date} />
    </div>
  );
}

// Inline highlight for a client-supplied field that is still BLANK on the draft
// / pre-sign document — a tinted "to be confirmed by the Client on signing"
// marker so it's obvious what's outstanding. Once the client fills it in, the
// real value replaces this and the document reads as plain text (no highlight),
// so the executed contract looks clean and unmarked.
function ClientFillHint({ children }) {
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[0.92em] font-medium" style={{ background:'rgba(217,119,6,0.10)', color:'#B45309', border:'1px solid rgba(217,119,6,0.25)' }}>
      [ {children} ]
    </span>
  );
}

// Shared, presentational rendering of the full contract document body.
// Used by the admin ContractDocument view AND the client SigningFlow review
// screen so both parties review EXACTLY the same legal document.
function ContractDocumentBody({ contract, client, company }) {
  const lineItems = contract.services ? computeServiceLineItems(contract.services) : [];
  const termYears = contract.startDate && contract.endDate ? Math.max(1, Math.round(daysBetween(contract.startDate, contract.endDate)/365)) : null;

  return (
    <React.Fragment>
        {/* Navy brand header band: two-logo lockup + contract reference (cyan) */}
        <div
          className="rounded-t-lg -mx-10 -mt-10 px-10 py-8"
          style={{ background: 'var(--navy-deep)', WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}
        >
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center justify-center">
              {/* Always use the official SCIOS logo (bright/colourful — reads on navy) */}
              <img src="Logo-scios-dark.png" alt="Science of Sports" className="h-16 w-auto object-contain" />
            </div>
            <div className="text-[var(--cyan)] text-2xl font-light">×</div>
            <div className="flex items-center justify-center">
              {client.logoBase64 ? <img src={client.logoBase64} alt={client.companyName} className="h-16 w-auto object-contain" /> : <div className="font-heading text-white">{client.companyName}</div>}
            </div>
          </div>
          <p className="text-center text-sm font-semibold tracking-wide mt-6" style={{ color:'var(--cyan)' }}>{contract.contractNumber}</p>
        </div>

        {/* Signature SCIOS rainbow hairline directly under the header band */}
        <div className="sos-rainbow-bleed mb-10" />

        {/* Title split on the dash: client name on top, agreement type below. */}
        {(() => {
          const parts = (contract.title || '').split(/\s+[—–-]\s+/);
          const top = (parts[0] || contract.title || '').toUpperCase();
          const sub = parts.length > 1 ? parts.slice(1).join(' — ').toUpperCase() : null;
          return (
            <div className="text-center mb-8">
              <h1 className="font-display" style={{ color:'var(--navy-deep)' }}>{top}</h1>
              {sub && <div className="font-heading tracking-wide mt-1" style={{ color:'var(--navy-deep)' }}>{sub}</div>}
            </div>
          );
        })()}

        <p className="text-sm text-slate-700 mb-6">
          This Agreement is made on <strong>{fmtDate(contract.createdAt || contract.sentAt || new Date().toISOString())}</strong> between:
        </p>
        <p className="text-sm text-slate-700 mb-4">
          <strong>{company.name}</strong>, a company registered under the laws of the Republic of Cyprus with registration number {company.registrationNumber}, VAT number {company.vatNumber}, having its registered office at {company.registeredAddress} (the "Service Provider"),
        </p>
        <p className="text-sm text-slate-700 mb-6">and</p>
        <p className="text-sm text-slate-700 mb-8">
          <strong>{client.companyName}</strong>,{' '}
          {client.registrationNumber
            ? `a company registered with registration number ${client.registrationNumber}, `
            : <ClientFillHint>registration number to be confirmed by the Client on signing</ClientFillHint>}
          {client.registrationNumber ? '' : ', '}having its registered office at{' '}
          {client.address
            ? client.address
            : <ClientFillHint>to be confirmed by the Client on signing</ClientFillHint>}
          {' '}(the "Client").
        </p>
        <p className="text-sm text-slate-700 mb-8">The above are hereinafter jointly referred to as the "Parties".</p>

        {/* About the Service Provider — informational credibility section, kept OUTSIDE
            the numbered-clause IIFE so it never shifts clause numbers. Rendered as a
            clean section (no tinted box) to match the Purpose clause below. */}
        <div className="mb-8">
          <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>About the Service Provider</div>
          <p className="text-sm text-slate-700 mb-3">Science of Sports (C.C. Science of Sports Ltd, HE 449875) is Cyprus's leading football intelligence company. Built by UEFA-qualified analysts and engineers, it operates the first fully integrated football analytics platform originating from Cyprus, serving federations, academies, coaches, scouts and players.</p>
          <ul className="text-sm text-slate-700 space-y-1.5 list-disc pl-5">
            <li>Official Performance Analysis Partner of the Cyprus Football Association — the platform trusted by all Cyprus National Teams.</li>
            <li>15 countries analysed · 150+ teams served · 3,000+ players profiled.</li>
            <li>1,000+ youth and national-team matches analysed annually.</li>
            <li>Official partner of the Cyprus Coaches Association (creators of the "Coach of the Month" awards).</li>
            <li>Founders of the Annual Youth Football Player &amp; Coach Awards.</li>
            <li>Creators of "Youth Zone" with Cablenet — Cyprus's first TV show dedicated to youth football.</li>
          </ul>
        </div>

        {(() => {
          let n = 1;
          const purposeNum = n++;
          const scopeNum = lineItems.length > 0 ? n++ : null;
          const analysisScope = analysisScopeText(contract, seasonLabelFromDates(contract.startDate, contract.endDate));
          const analysisNum = analysisScope.teams ? n++ : null;
          const feesNum = n++;
          const commercial = commercialModelText(contract, (a) => fmtMoney(a, contract.currency));
          const commercialNum = commercial.intro ? n++ : null;
          const serviceLevelsNum = n++;
          const confidentialityNum = n++;
          const ipNum = n++;
          const durationNum = n++;
          const terminationNum = n++;
          const liabilityNum = n++;
          const forceMajeureNum = n++;
          const governingLawNum = n++;
          const specialTermsParsed = parseSpecialTerms(contract.specialTerms);
          const specialTermsNum = specialTermsParsed.length ? n++ : null;
          const entireAgreementNum = n++;
          return (
            <React.Fragment>
              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{purposeNum}.</span> Purpose</div>
              {lineItems.length > 0 ? (
                <div className="mb-8">
                  <p className="text-sm text-slate-700 mb-4">The purpose of this Agreement is to define the terms of cooperation between the Parties, under which the Service Provider shall provide the Client with the following services:</p>
                  {SERVICE_GROUPS.map(group => {
                    const groupItems = lineItems.filter(i => i.group === group);
                    if (!groupItems.length) return null;
                    return (
                      <div key={group} className="mb-5 last:mb-0">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span aria-hidden style={{ background:'var(--cyan)', width:3, height:14, borderRadius:2, WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }} />
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color:'var(--navy-deep)' }}>{group}</span>
                        </div>
                        <div className="space-y-2">
                          {groupItems.map(i => {
                            const qtyNote = i.unit === 'per_match' ? ` (${i.qty} matches)` : i.unit === 'per_unit' ? ` (${i.qty})` : '';
                            const chip = i.included ? 'Included' : null;
                            return (
                              <div key={i.key} className="text-sm text-slate-700">
                                <span className="font-medium" style={{ color:'var(--navy-deep)' }}>{i.label}</span>
                                {qtyNote && <span className="text-slate-500">{qtyNote}</span>}
                                {chip && <span className="sos-chip sos-chip-green ml-2 align-middle" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>{chip}</span>}
                                <span className="text-slate-500"> — {i.detail}</span>
                                {i.key === 'platform_access' && platformSeatsSummary(contract.services.platform_access) && (
                                  <div className="text-xs text-slate-600 mt-0.5">Access: {platformSeatsSummary(contract.services.platform_access)} (exact users to be confirmed with the client)</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-sm text-slate-700 mt-4">Key analytical outputs are delivered after each match in accordance with the Service Levels set out below.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-700 mb-8 whitespace-pre-line">{contract.description || 'The purpose of this Agreement is to define the terms of cooperation between the Parties for the provision of performance analysis and related services by the Service Provider to the Client.'}</p>
              )}

              {scopeNum && (
                <React.Fragment>
                  <div className="sos-pill mb-4" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{scopeNum}.</span> Scope of Services</div>
                  <table className="w-full text-sm mb-8 border-collapse">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide" style={{ background:'rgba(10,26,63,0.05)', color:'var(--navy-deep)' }}>
                        <th className="py-2.5 px-3 rounded-l-md">Service</th>
                        <th className="py-2.5 px-3 text-right rounded-r-md">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map(i => (
                        <tr key={i.key} className="border-b border-[var(--border)]">
                          <td className="py-2 px-3">
                            {i.label}
                            {i.key === 'platform_access' && platformSeatsSummary(contract.services.platform_access) && (
                              <div className="text-xs text-slate-600">Access: {platformSeatsSummary(contract.services.platform_access)} (exact users to be confirmed with the client)</div>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-data whitespace-nowrap">
                            {i.included
                              ? (i.listPrice > 0
                                  ? <><span className="line-through text-slate-400">{fmtMoney(i.listPrice, contract.currency)}</span> <span className="text-emerald-600">Incl.</span></>
                                  : <span className="text-emerald-600">Included</span>)
                              : fmtMoney(i.listPrice, contract.currency)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop:'2px solid var(--navy-deep)' }}>
                        <td className="py-3 px-3 font-semibold" style={{ color:'var(--navy-deep)' }}>Total Contract Value</td>
                        <td className="py-3 px-3 text-right font-data font-bold" style={{ color:'var(--navy-deep)' }}>{fmtMoney(contract.value, contract.currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </React.Fragment>
              )}

              {analysisNum && (
                <React.Fragment>
                  <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{analysisNum}.</span> Scope of Analysis</div>
                  <p className={`text-sm text-slate-700 ${analysisScope.opponent ? 'mb-3' : 'mb-8'}`}>The Service Provider shall provide performance analysis for the following teams of the Client: <strong style={{ color:'var(--navy-deep)' }}>{analysisScope.teams}</strong>. {analysisScope.coverage}</p>
                  {analysisScope.opponent && (
                    <div className="mb-8 flex items-center gap-2 flex-wrap">
                      <span aria-hidden style={{ background:'var(--cyan)', width:3, height:14, borderRadius:2, WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }} />
                      <span className="text-xs font-bold uppercase tracking-wide mr-1" style={{ color:'var(--navy-deep)' }}>Opponent access:</span>
                      <span className="text-sm text-slate-700">{analysisScope.opponent}</span>
                    </div>
                  )}
                </React.Fragment>
              )}

              {(() => { const vs = vatSummary(contract, (a) => fmtMoney(a, contract.currency), client); return (
              <React.Fragment>
              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{feesNum}.</span> Fees & Payment</div>
              <p className="text-sm text-slate-700 mb-2">In consideration of the services provided under this Agreement, the Client shall pay the Service Provider a total of <strong>{fmtMoney(contract.value, contract.currency)}</strong>{vs.applies ? ' (exclusive of VAT)' : ''}, payable <strong>{contract.paymentType === 'one_time' ? 'in a single payment' : contract.paymentType === 'milestone' ? 'in instalments' : contract.paymentType.replace('_',' ')}</strong>, net {contract.paymentTermsDays} days from the date of a valid invoice.</p>
              {vs.sentence && <p className="text-sm text-slate-700 mb-2">{vs.sentence}</p>}
              {Array.isArray(contract.payments) && contract.payments.length > 1 && (
                <table className="w-full text-sm mb-4 border-collapse">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide" style={{ background:'rgba(10,26,63,0.05)', color:'var(--navy-deep)' }}>
                      <th className="py-2 px-3 rounded-l-md">Payment</th>
                      <th className="py-2 px-3">Due Date</th>
                      <th className="py-2 px-3 text-right rounded-r-md">{vs.amountLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.payments.map((p, i) => (
                      <tr key={i} className="border-b border-[var(--border)]">
                        <td className="py-2 px-3">Instalment {i + 1}</td>
                        <td className="py-2 px-3">{p.dueDate ? fmtDate(p.dueDate) : '—'}</td>
                        <td className="py-2 px-3 text-right font-data">{fmtMoney(p.totalAmount != null ? p.totalAmount : p.amount, contract.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              </React.Fragment>
              ); })()}
              <p className="text-sm text-slate-700 mb-4">All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations. A late payment penalty of {contract.latePaymentPenalty}% per month applies to overdue amounts.</p>
              {(company.bankName || company.bankIBAN || company.bankSWIFT) && (
                <div className="text-sm text-slate-700 mb-8 rounded-lg p-4" style={{ background:'rgba(10,26,63,0.04)', border:'1px solid var(--border)' }}>
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color:'var(--navy-deep)' }}>Bank Details (Service Provider)</div>
                  <div>Account Name: <strong>{company.name}</strong></div>
                  {company.bankName && <div>Bank: <strong>{company.bankName}</strong></div>}
                  {company.bankIBAN && <div>IBAN: <strong>{company.bankIBAN}</strong></div>}
                  {company.bankSWIFT && <div>SWIFT/BIC: <strong>{company.bankSWIFT}</strong></div>}
                </div>
              )}

              {commercialNum && (
                <React.Fragment>
                  <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{commercialNum}.</span> Commercial Terms & Club Commission</div>
                  <p className="text-sm text-slate-700 mb-2"><span className="font-semibold" style={{ color:'var(--navy-deep)' }}>{commercial.intro}.</span> {commercial.breakdown}</p>
                  {commercial.commission && <p className="text-sm text-slate-700 mb-8">{commercial.commission}</p>}
                </React.Fragment>
              )}

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{serviceLevelsNum}.</span> Service Levels</div>
              {serviceLevelsLines(contract).map((ln, i) => (
                <p key={i} className="text-sm text-slate-700 mb-2">{ln} These timeframes exclude weekends, public holidays and any delay caused by the Client, third parties or events beyond the Service Provider's reasonable control.</p>
              ))}
              <p className="text-sm text-slate-700 mb-8">Where the Service Provider fails to meet the applicable service level for a given match, it shall remedy the delay within a reasonable cure period. The Client's sole and exclusive remedy for a service-level failure shall be a proportionate service credit against the fees for the affected deliverables; a service-level failure shall not, of itself, entitle the Client to terminate this Agreement, save in the case of repeated and material failures not remedied following written notice.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{confidentialityNum}.</span> Confidentiality & Data Protection</div>
              <div className="mb-8 pl-4 pr-5 py-4 rounded-r-lg" style={{ background:'#EEF0FB', borderLeft:'3px solid var(--navy-deep)', WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>
                <p className="text-sm text-slate-700 mb-2"><span className="font-semibold" style={{ color:'var(--navy-deep)' }}>Confidentiality & GDPR.</span> The Service Provider shall process personal data strictly in accordance with the GDPR, the applicable Cyprus data protection legislation (Law 125(I)/2018), and Regulation (EU) 2016/679, and solely on documented instructions from the Client and exclusively for the purposes of this Agreement.</p>
                <p className="text-sm text-slate-700 mb-2">In respect of personal data processed under this Agreement, the Client acts as data controller and the Service Provider as data processor. The Service Provider shall process such data only as needed to provide the services, keep it secure, not transfer it outside the EEA without safeguards, assist the Client with data-subject requests, and delete or return the data on termination. Where the data concerns minors, the Client is responsible for obtaining any necessary parental or guardian consent.</p>
                <p className="text-sm text-slate-700">All match analysis, reports, video clips, data outputs, and technical insights produced under this Agreement shall be treated as strictly confidential and used solely for the Client's internal purposes.</p>
              </div>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{ipNum}.</span> Intellectual Property Rights</div>
              <p className="text-sm text-slate-700 mb-3">The match footage, video recordings, reports, analytics outputs, clips and other deliverables produced for the Client under this Agreement (the "Deliverables") are provided for the Client's use. The Service Provider grants the Client a perpetual, irrevocable, royalty-free licence to use, reproduce, store and archive the Deliverables for the Client's own internal football and operational purposes. The Service Provider shall not disclose or share the Client's Deliverables with any third party without the Client's prior written consent, save as required by law.</p>
              <p className="text-sm text-slate-700 mb-8">The Service Provider retains all right, title and interest in its platform, software, systems, methodologies, know-how, models and templates, and in any pre-existing or independently developed materials (the "Service Provider IP"), which are licensed to the Client only as necessary to receive the services. The Service Provider may retain internal copies of the Deliverables and may use anonymised and aggregated data derived from the services for benchmarking, research and the improvement and provision of its products and services, provided that no such use identifies the Client, its players or its teams without the Client's consent.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{durationNum}.</span> Duration</div>
              <p className="text-sm text-slate-700 mb-8">This Agreement shall commence on <strong>{fmtDate(contract.startDate)}</strong> and shall remain in force until <strong>{fmtDate(contract.endDate)}</strong>{termYears ? ` (approximately ${termYears} year${termYears>1?'s':''})` : ''}, unless terminated earlier in accordance with Section {terminationNum}.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{terminationNum}.</span> Termination</div>
              <p className="text-sm text-slate-700 mb-2">Either Party may terminate this Agreement with three (3) months' written notice, or immediately in the event of a material breach not remedied within thirty (30) days.</p>
              <p className="text-sm text-slate-700 mb-8">Upon termination or expiration of this Agreement for any reason, the Service Provider shall promptly deliver to the Client all Deliverables produced under this Agreement.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{liabilityNum}.</span> Limitation of Liability</div>
              <p className="text-sm text-slate-700 mb-8">The Service Provider shall not be responsible for sporting results, team selection decisions, or competition outcomes. Total liability under this Agreement shall not exceed the fees paid during the preceding twelve (12) months. This limitation shall not apply to breaches of confidentiality, data protection obligations, or unauthorized use of the Client's data or intellectual property.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{forceMajeureNum}.</span> Force Majeure</div>
              <p className="text-sm text-slate-700 mb-8">Neither Party shall be liable for failure to perform due to events beyond reasonable control.</p>

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{governingLawNum}.</span> Governing Law & Jurisdiction</div>
              <p className="text-sm text-slate-700 mb-8">This Agreement shall be governed by the laws of {contract.governingLaw}, with exclusive jurisdiction in {contract.jurisdiction}.</p>

              {specialTermsNum && (
                <React.Fragment>
                  <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{specialTermsNum}.</span> Special Terms</div>
                  <ol className="text-sm text-slate-700 mb-8 space-y-2 list-decimal pl-5">
                    {specialTermsParsed.map((t, i) => (
                      <li key={i}>
                        {t.relatesTo && t.relatesTo !== 'General' && <span className="font-semibold" style={{ color:'var(--navy-deep)' }}>Re: {t.relatesTo}. </span>}
                        <span className="whitespace-pre-line">{t.text}</span>
                      </li>
                    ))}
                  </ol>
                </React.Fragment>
              )}

              <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}><span className="num">{entireAgreementNum}.</span> Entire Agreement & Amendments</div>
              <p className="text-sm text-slate-700 mb-12">This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.</p>
            </React.Fragment>
          );
        })()}

        {/* Client's designated contact — captured from the client during signing. */}
        {contract.contactName && (
          <React.Fragment>
            <div className="sos-pill mb-3" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>Designated Contact</div>
            <p className="text-sm text-slate-700 mb-8">
              Client's designated contact for operations &amp; communication: <strong>{contract.contactName}</strong>
              {contract.contactRole ? `, ${contract.contactRole}` : ''}
              {contract.contactEmail ? ` · ${contract.contactEmail}` : ''}
              {contract.contactPhone ? ` · ${contract.contactPhone}` : ''}.
              {(contract.financeName || contract.financeEmail) && (
                <> Finance contact: {contract.financeName || ''}{contract.financeName && contract.financeEmail ? ' · ' : ''}{contract.financeEmail || ''}.</>
              )}
            </p>
          </React.Fragment>
        )}

        {/* Navy closing panel — warm, confident sign-off before the signatures. */}
        <div className="rounded-lg px-6 py-5 mb-10" style={{ background:'var(--navy-deep)', WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>
          <p className="text-sm leading-relaxed" style={{ color:'#E6ECF7' }}>
            Science of Sports is proud to partner with {client.companyName} and is committed to delivering
            performance analysis of the highest professional standard throughout this Agreement.
            <span className="font-semibold" style={{ color:'var(--cyan)' }}> Transforming matches into knowledge — together.</span>
          </p>
        </div>

        <div className="sos-pill mb-2" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>Signatures</div>
        <p className="text-xs text-slate-500 mb-6">Executed by the duly authorised representatives of the Parties as of the dates set out below.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-sm">
          {/* Service Provider — auto-applied Scios authorised signatory. */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color:'var(--navy-deep)' }}>For and on behalf of {company.name}</div>
            {company.signatoryName ? (
              <SignatureLines
                signatureImage={company.signatorySignature || null}
                signature={company.signatoryName}
                name={company.signatoryName}
                title={company.signatoryTitle}
                date={fmtDate(contract.signedAt || contract.sentAt || contract.createdAt)}
              />
            ) : (
              <SignatureLines />
            )}
          </div>
          {/* Client */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color:'var(--navy-deep)' }}>For and on behalf of {client.companyName}</div>
            {contract.signedAt ? (
              <SignatureLines
                signature={contract.signerName}
                name={contract.signerName}
                title={contract.signerTitle}
                date={fmtDate(contract.signedAt)}
              />
            ) : (
              <SignatureLines />
            )}
          </div>
        </div>

        {/* Signature SCIOS rainbow hairline directly above the footer band */}
        <div className="sos-rainbow-bleed mt-12" />
        {/* Branded navy footer band with company details + SCIOS tagline */}
        <div
          className="rounded-b-lg -mx-10 -mb-10 px-10 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          style={{ background: 'var(--navy-deep)', WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}
        >
          <div className="text-xs leading-relaxed" style={{ color:'#A9B6CC' }}>
            <div className="font-semibold text-white">{company.name}</div>
            <div>{company.registeredAddress}</div>
            <div>{company.contactEmail}</div>
            <div>Reg. No. {company.registrationNumber}{company.vatNumber ? ' · VAT ' + company.vatNumber : ''}</div>
          </div>
          <div className="text-sm italic md:text-right" style={{ color:'var(--cyan)' }}>Transforming matches into knowledge.</div>
        </div>
    </React.Fragment>
  );
}

function ContractDocument({ contractId, navigate }) {
  const [contract, setContract] = useState(null);
  const [client, setClient] = useState(null);
  const [company, setCompany] = useState(null);
  // `frozen` = we are showing the immutable snapshot that was actually
  // sent/signed (not a live re-render). `signedPdfUrl` = the authoritative
  // executed PDF the client received, when the contract is signed.
  const [frozen, setFrozen] = useState(false);
  const [frozenStatus, setFrozenStatus] = useState(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState(null);

  useEffect(() => {
    (async () => {
      const c = await contractService.getById(contractId);
      // For any contract that has been sent onward (sent/active/signed/declined),
      // the source of truth is the FROZEN document that was captured at Send —
      // identical to what the client saw and (if signed) signed. Render that,
      // never a live re-derivation from today's contract row. Drafts render live.
      const isDraft = c && (c.status === 'draft' || !c.status);
      let usedFrozen = false;
      if (c && !isDraft) {
        try {
          const snap = await contractService.getFrozenSnapshot(contractId);
          if (snap && snap.snapshot) {
            const ns = normalizeSnapshot(snap.snapshot);
            // Carry the live signer/execution fields onto the frozen contract so
            // the signature block renders the client's name/date (these live on
            // the contract row, not in the send-time snapshot).
            setContract({ ...ns.contract, signedAt: c.signedAt, signerName: c.signerName, signerTitle: c.signerTitle, signerCompany: c.signerCompany, signerEmail: c.signerEmail });
            setClient(ns.client);
            setCompany(ns.company);
            setFrozenStatus(snap.status);
            setSignedPdfUrl(snap.signedPdfUrl || null);
            usedFrozen = true;
          }
        } catch (_) { /* fall through to live render if the snapshot is unreadable */ }
      }
      if (!usedFrozen) {
        setContract(c);
        if (c) setClient(await clientService.getById(c.clientId));
        setCompany(await companyService.get());
      }
      setFrozen(usedFrozen);
    })();
  }, [contractId]);

  if (!contract || !client || !company) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4 no-print">
        <button onClick={()=>navigate('contract:'+contract.id)} className="text-sm text-slate-500 hover:text-slate-700">← Back to Contract</button>
        <div className="flex items-center gap-2">
          {signedPdfUrl && (
            <a href={signedPdfUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 border border-[var(--border)] text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition">Download signed PDF</a>
          )}
          <button onClick={()=>window.print()} className="px-4 py-2 bg-[var(--blue-primary)] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Print / Save as PDF</button>
        </div>
      </div>

      {!frozen && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-700 mb-4 no-print">
          This is a template-generated draft. Review all clauses, values and dates carefully — and have it checked by a Cyprus lawyer — before sending it to a client for signature.
        </div>
      )}
      {frozen && (
        <div className="bg-slate-50 border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm text-slate-600 mb-4 no-print flex items-center gap-2">
          <span>🔒</span>
          <span>
            {frozenStatus === 'signed'
              ? 'This is the executed document exactly as signed — identical to the copy sent to the client. It does not change if the contract is later edited.'
              : 'This is the frozen document exactly as sent to the client for signature. It does not change if the contract is later edited.'}
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[var(--border)] p-10 overflow-hidden">
        <ContractDocumentBody contract={contract} client={client} company={company} />
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
  const due = Number(payment.totalAmount || 0);
  const [amount, setAmount] = useState(payment.totalAmount);
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0,10));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const amt = Number(amount);
  const validAmount = amount !== '' && !isNaN(amt) && amt > 0;
  // A short payment (with a small rounding tolerance) leaves a balance — warn so
  // the user knows this closes the payment for less than what was due.
  const isPartial = validAmount && amt < due - 0.01;

  const submit = async () => {
    const e = {};
    if (!paidDate) e.paidDate = 'Date received is required.';
    else if (new Date(paidDate) > new Date()) e.paidDate = 'Date received cannot be in the future.';
    if (amount === '' || isNaN(amt)) e.amount = 'Enter the amount received.';
    else if (amt <= 0) e.amount = 'Amount must be greater than zero.';
    else if (amt > due + 0.01) e.amount = `Amount cannot exceed the ${fmtMoney(due, payment.currency)} due.`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const paidAt = new Date(paidDate).toISOString();
      await paymentService.markPaid(contract.id, payment.id, amt, auth.user.id, paidAt);
      await contractService.addAuditEntry(contract.id, { type:'payment', message:`${payment.description} marked as paid (${fmtMoney(amt, payment.currency)}${isPartial ? ` of ${fmtMoney(due, payment.currency)} due` : ''}) — received ${fmtDate(paidAt)}`, by: auth.user.id });
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
        <button disabled={busy} onClick={submit} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">Confirm Paid</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600 mb-1">Confirm payment received for <strong>{payment.description}</strong>.</p>
      <p className="text-xs text-slate-400 mb-4">Amount due: <span className="font-data">{fmtMoney(due, payment.currency)}</span></p>
      <Field label="Date Received" required error={errors.paidDate}>
        <input type="date" max={new Date().toISOString().slice(0,10)} value={paidDate} onChange={e=>setPaidDate(e.target.value)} className={inputCls(errors.paidDate)} />
      </Field>
      <Field label="Amount Received" required error={errors.amount}>
        <input type="number" step="0.01" min="0" value={amount} onChange={e=>setAmount(e.target.value)} className={inputCls(errors.amount)} />
      </Field>
      {isPartial && !errors.amount && (
        <p className="text-xs text-amber-600 mt-1">This is a partial payment — {fmtMoney(due - amt, payment.currency)} will remain unpaid. Marking it paid closes this line; log the balance as a separate payment if needed.</p>
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
  // Summary totals for the chase list.
  const totalOutstanding = rows.reduce((s,p)=>s+Number(p.totalAmount||0), 0);
  const totalOverdue = rows.filter(p=>effectiveStatus(p)==='overdue').reduce((s,p)=>s+Number(p.totalAmount||0), 0);
  const cur = rows[0]?.currency || 'EUR';

  // AR aging: total per bucket (Current / 1–30 / 31–60 / 61–90 / 90+), driving the
  // aging tiles and the exported chase list.
  const agingTotals = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  rows.forEach(p => { agingTotals[agingBucket(p)] += Number(p.totalAmount || 0); });
  const AGING_ORDER = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'];

  // Export the chase list as a CSV your accountant can work from directly.
  const exportChaseList = () => {
    const csv = toCSV(rows, [
      { label: 'Client', value: p => clientMap[p.contract.clientId]?.companyName || '' },
      { label: 'Contract', value: p => p.contract.title || '' },
      { label: 'Contract No.', value: p => p.contract.contractNumber || '' },
      { label: 'Description', value: p => p.description || '' },
      { label: 'Due Date', value: p => fmtDate(p.dueDate) },
      { label: 'Amount', value: p => Number(p.totalAmount || 0).toFixed(2) },
      { label: 'Currency', value: p => p.currency || cur },
      { label: 'Status', value: p => effectiveStatus(p) },
      { label: 'Days Overdue', value: p => String(daysOverdue(p)) },
      { label: 'Aging Bucket', value: p => AGING_LABELS[agingBucket(p)] },
      { label: 'Contact', value: p => clientMap[p.contract.clientId]?.contactName || '' },
      { label: 'Contact Email', value: p => clientMap[p.contract.clientId]?.contactEmail || '' },
    ]);
    const stamp = fmtDate(nowISO()).replace(/\//g, '-');
    downloadFile(csv, `SOS-receivables-chase-list-${stamp}.csv`);
  };

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-[var(--navy-deep)]">Receivables</div>
        {rows.length > 0 && (
          <button onClick={exportChaseList} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-slate-50 transition">⬇ Export chase list (CSV)</button>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-xl border border-[var(--border)] p-4"><div className="text-xs text-slate-400 mb-1">Total Outstanding</div><div className="font-display text-xl text-[var(--navy-deep)]">{fmtMoney(totalOutstanding, cur)}</div></div>
            <div className="bg-white rounded-xl border border-red-200 p-4"><div className="text-xs text-red-500 mb-1">Overdue</div><div className="font-display text-xl text-red-600">{fmtMoney(totalOverdue, cur)}</div></div>
          </div>
          {/* AR aging breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
            {AGING_ORDER.map(key => {
              const overdueBucket = key !== 'current';
              return (
                <div key={key} className={`bg-white rounded-xl border p-3 ${key === 'd90_plus' && agingTotals[key] > 0 ? 'border-red-300' : 'border-[var(--border)]'}`}>
                  <div className={`text-[11px] mb-1 ${overdueBucket && agingTotals[key] > 0 ? 'text-red-500' : 'text-slate-400'}`}>{AGING_LABELS[key]}</div>
                  <div className={`font-display text-base ${overdueBucket && agingTotals[key] > 0 ? 'text-red-600' : 'text-[var(--navy-deep)]'}`}>{fmtMoney(agingTotals[key], cur)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {rows.length === 0 ? <EmptyState title="Nothing outstanding" icon="🎉" /> : (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-400 border-b border-[var(--border)]"><th className="py-3 px-4">Description</th><th className="py-3 px-4">Client</th><th className="py-3 px-4">Due</th><th className="py-3 px-4">Total</th><th className="py-3 px-4">Aging</th><th className="py-3 px-4">Status</th><th className="py-3 px-4"></th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-slate-50">
                  <td className="py-3 px-4 text-xs">{p.description}</td>
                  <td className="py-3 px-4">{clientMap[p.contract.clientId]?.companyName}</td>
                  <td className="py-3 px-4">{fmtDate(p.dueDate)}</td>
                  <td className="py-3 px-4 font-data">{fmtMoney(p.totalAmount, p.currency)}</td>
                  <td className="py-3 px-4 text-xs text-slate-500">{AGING_LABELS[agingBucket(p)]}</td>
                  <td className="py-3 px-4"><Badge status={effectiveStatus(p)} />{daysOverdue(p) > 0 && <span className="ml-1 text-[10px] text-red-500">{daysOverdue(p)}d</span>}</td>
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
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const res = await signingService.sendPaymentReminder(payment.id);
      setSent(true);
      toast.push(`Reminder emailed to ${res.sentTo || 'the client'}.`, 'success');
    } catch (err) {
      toast.push(err.message || 'Could not send the reminder.', 'error');
    } finally {
      setBusy(false);
    }
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
        {!sent && <button onClick={send} disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-[var(--blue-primary)] text-white hover:bg-blue-700 disabled:opacity-50">{busy ? 'Sending…' : 'Send Reminder'}</button>}
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
      {sent && <div className="text-xs text-emerald-600 mt-3">✓ Reminder emailed to the client and logged.</div>}
      <p className="text-[11px] text-slate-400 mt-2">This preview reflects the email; the actual email is sent branded via Science of Sports.</p>
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
      <div className="font-display mb-6 text-[var(--navy-deep)]">Payment History</div>
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
  const [statsByClient, setStatsByClient] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState(() => localStorage.getItem('clientsView') || 'cards');
  const [sort, setSort] = useState(() => localStorage.getItem('clientsSort') || 'name');

  const setViewMode = (v) => { setView(v); localStorage.setItem('clientsView', v); };
  const setSortMode = (v) => { setSort(v); localStorage.setItem('clientsSort', v); };

  const load = useCallback(() => {
    clientService.getAll().then(setClients);
    // Per client, derive: most-advanced contract status + total contract value.
    contractService.getAll().then(contracts => {
      const rank = { active: 5, signed: 4, sent: 3, draft: 2, expired: 1, cancelled: 0 };
      const stats = {};
      contracts.forEach(c => {
        if (!c.clientId) return;
        const s = stats[c.clientId] || (stats[c.clientId] = { status: null, total: 0, currency: c.currency || 'EUR', endDate: null });
        s.total += Number(c.value) || 0;
        if (s.status === null || (rank[c.status] ?? -1) > (rank[s.status] ?? -1)) s.status = c.status;
        if (c.endDate && (!s.endDate || c.endDate > s.endDate)) s.endDate = c.endDate;
      });
      setStatsByClient(stats);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!clients) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c => [c.companyName, c.contactName, c.contactEmail]
        .some(f => (f || '').toLowerCase().includes(q)))
    : clients;

  const statusRank = { active: 5, signed: 4, sent: 3, draft: 2, expired: 1, cancelled: 0 };
  const name = c => (c.companyName || '').toLowerCase();
  const visible = [...filtered].sort((a, b) => {
    const sa = statsByClient[a.id], sb = statsByClient[b.id];
    switch (sort) {
      case 'amount':   // biggest deals first; ties → name
        return ((sb?.total || 0) - (sa?.total || 0)) || name(a).localeCompare(name(b));
      case 'endDate': { // soonest renewal first; no-contract sinks to bottom
        const ea = sa?.endDate || '9999', eb = sb?.endDate || '9999';
        return ea.localeCompare(eb) || name(a).localeCompare(name(b));
      }
      case 'status':   // most-advanced first; ties → name
        return ((statusRank[sb?.status] ?? -1) - (statusRank[sa?.status] ?? -1)) || name(a).localeCompare(name(b));
      case 'recent':   // newest added first
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      default:         // name A–Z
        return name(a).localeCompare(name(b));
    }
  });

  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="font-display text-[var(--navy-deep)]">Clients</div>
        {auth.isAdmin && <button onClick={()=>setShowForm(true)} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-medium transition">+ New Client</button>}
      </div>
      {clients.length === 0 ? <EmptyState title="No clients yet" subtitle="Add your first client to start creating contracts." ctaLabel={auth.isAdmin ? "New Client" : null} onCta={()=>setShowForm(true)} icon="🏟️" /> : (
        <>
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clients by name, contact, or email…" className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg flex-1 md:max-w-sm" />
          <select value={sort} onChange={e=>setSortMode(e.target.value)} className="px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-white text-slate-600" title="Sort clients">
            <option value="name">Name (A–Z)</option>
            <option value="amount">Amount (high→low)</option>
            <option value="endDate">End of contract (soonest)</option>
            <option value="status">Status</option>
            <option value="recent">Recently added</option>
          </select>
          <div className="inline-flex rounded-lg border border-[var(--border)] overflow-hidden text-sm">
            <button onClick={()=>setViewMode('list')} className={`px-3 py-2 transition ${view==='list' ? 'bg-[var(--navy-deep)] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} title="List view">☰ List</button>
            <button onClick={()=>setViewMode('cards')} className={`px-3 py-2 transition border-l border-[var(--border)] ${view==='cards' ? 'bg-[var(--navy-deep)] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`} title="Card view">▦ Cards</button>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">No clients match “{search}”.</div>
        ) : view === 'cards' ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {visible.map(c => (
            <button key={c.id} onClick={()=>setEditClient(c)} className="aspect-square text-center bg-white rounded-lg border border-[var(--border)] p-3 hover:border-blue-300 hover:shadow-sm transition cursor-pointer flex flex-col items-center justify-center gap-2 overflow-hidden">
              <ClientLogo client={c} size={44} />
              <div className="w-full min-w-0">
                <div className="font-heading text-sm truncate">{c.companyName}</div>
                <div className="font-data text-sm text-[var(--navy-deep)] mb-1.5">
                  {statsByClient[c.id]?.total ? fmtMoney(statsByClient[c.id].total, statsByClient[c.id].currency) : '—'}
                </div>
                {statsByClient[c.id]?.status
                  ? <Badge status={statsByClient[c.id].status} />
                  : <span className="text-[11px] text-slate-300">No contract</span>}
              </div>
            </button>
          ))}
        </div>
        ) : (
        <div className="bg-white rounded-xl border border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
          {visible.map(c => (
            <button key={c.id} onClick={()=>setEditClient(c)} className="w-full text-left flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer">
              <ClientLogo client={c} size={32} />
              <div className="font-heading text-sm truncate flex-1 min-w-0">{c.companyName}</div>
              <div className="hidden md:block text-xs text-slate-400 truncate flex-1 min-w-0">{c.contactEmail}</div>
              <div className="font-data text-sm text-[var(--navy-deep)] whitespace-nowrap w-24 text-right">
                {statsByClient[c.id]?.total ? fmtMoney(statsByClient[c.id].total, statsByClient[c.id].currency) : '—'}
              </div>
              <div className="whitespace-nowrap w-24 text-right">
                {statsByClient[c.id]?.status
                  ? <Badge status={statsByClient[c.id].status} />
                  : <span className="text-[11px] text-slate-300">No contract</span>}
              </div>
            </button>
          ))}
        </div>
        )}
        </>
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
  // CC recipients (finance, a director…) — up to 3 email inputs; non-empty
  // ones are collected into ccEmails on save. Padded to 3 for stable inputs.
  const [ccEmails, setCcEmails] = useState(() => {
    const existing = (client && Array.isArray(client.ccEmails)) ? client.ccEmails : [];
    return [existing[0] || '', existing[1] || '', existing[2] || ''];
  });
  const setCc = (i, v) => setCcEmails(arr => arr.map((x, idx) => idx === i ? v : x));
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
      // Normalize to PNG so the logo embeds in the sent/signed PDFs (pdf-lib
      // can't embed WEBP/GIF/SVG — it would silently fall back to a text name).
      const base64 = await fileToPngDataUrl(file);
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
    // CC recipients: validate only the non-blank ones; ignore blanks.
    const ccTrimmed = ccEmails.map(x => (x || '').trim());
    ccTrimmed.forEach((x, i) => { if (x && !validateEmail(x)) e[`cc${i}`] = 'Enter a valid email.'; });
    setErrors(e);
    if (Object.keys(e).length) return;
    const cleanedCc = ccTrimmed.filter(x => x && validateEmail(x));
    setBusy(true);
    try {
      const payload = { ...form, vatNumber: form.vatNumber || null, registrationNumber: form.registrationNumber || null, logoBase64: logoBase64 || null, ccEmails: cleanedCc };
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

      <div className="mt-2 pt-3 border-t border-[var(--border)]">
        <div className="text-sm font-medium mb-1">CC recipients (optional)</div>
        <p className="text-xs text-slate-400 mb-3">These people also receive the signing request and the signed certificate (they don't sign).</p>
        {[0,1,2].map(i => (
          <Field key={i} label={i === 0 ? 'CC email 1' : `CC email ${i+1}`} error={errors[`cc${i}`]}>
            <input disabled={readOnly} type="email" value={ccEmails[i]} onChange={e=>setCc(i, e.target.value)} className={inputCls(errors[`cc${i}`])} placeholder={i === 0 ? 'finance@yourclub.com' : (i === 1 ? 'director@yourclub.com' : 'you@yourclub.com')} />
          </Field>
        ))}
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
      <div className="font-display mb-6 text-[var(--navy-deep)]">Revenue Report</div>
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
    downloadFile('﻿'+rows.map(r=>r.join(',')).join('\r\n'), 'sos-board-export.csv');
    toast.push('Board export downloaded.', 'success');
  };

  return (
    <div className="p-4 md:p-6">
      <div className="font-display mb-6 text-[var(--navy-deep)]">Board Export</div>
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
  const [saving, setSaving] = useState(false);

  // Empty company shape used when the database has no company row yet (fresh
  // install) — so the form always renders and the profile can be filled in.
  const EMPTY_COMPANY = {
    name: '', registeredAddress: '', vatNumber: '', registrationNumber: '',
    contactEmail: '', website: '', bankName: '', bankIBAN: '', bankSWIFT: '', logo: null,
    signatoryName: '', signatoryTitle: '', signatorySignature: null,
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
    setSaving(true);
    try {
      const updated = await companyService.update(form);
      setForm(updated);
      toast.push('Company profile saved.', 'success');
    } catch (err) {
      toast.push('Could not save: ' + (err.message || 'unknown error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const onLogoPicked = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.push('Logo must be an image file.', 'error'); return; }
    if (file.size > 1024 * 1024) { toast.push('Logo must be under 1MB.', 'error'); return; }
    // Normalize to PNG so the logo embeds in the sent/signed PDFs (pdf-lib can't
    // embed WEBP/GIF/SVG).
    const base64 = await fileToPngDataUrl(file);
    const updated = await companyService.update({ logo: base64 });
    setForm(updated);
    toast.push('Logo updated.', 'success');
  };

  const removeLogo = async () => {
    const updated = await companyService.update({ logo: null });
    setForm(updated);
    toast.push('Logo removed.', 'success');
  };

  const onSignaturePicked = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.push('Signature must be an image file.', 'error'); return; }
    if (file.size > 1024 * 1024) { toast.push('Signature image must be under 1MB.', 'error'); return; }
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the file.'));
      reader.readAsDataURL(file);
    });
    set('signatorySignature', base64); // saved on "Save Signatory"
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
      <div className="font-display mb-6 text-[var(--navy-deep)]">Company Profile</div>
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
        {auth.isAdmin && <button onClick={save} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-medium transition">Save Changes</button>}
      </div>

      {/* Authorised signatory — auto-applied to every contract so agreements
          are executed as genuine two-party documents (Scios counter-signs). */}
      <div className="bg-white rounded-xl border border-[var(--border)] p-6 mb-6">
        <div className="font-heading text-base mb-1 text-[var(--navy-deep)]">Authorised Signatory</div>
        <p className="text-sm text-slate-500 mb-4">This person's signature is automatically applied as the Service Provider's counter-signature on every contract, so each agreement is signed by both parties.</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Signatory Name"><input disabled={!auth.isAdmin} value={form.signatoryName || ''} onChange={e=>set('signatoryName',e.target.value)} placeholder="e.g. Constantinos Charalambides" className={inputCls(false)} /></Field>
          <Field label="Signatory Title"><input disabled={!auth.isAdmin} value={form.signatoryTitle || ''} onChange={e=>set('signatoryTitle',e.target.value)} placeholder="e.g. CEO / Director" className={inputCls(false)} /></Field>
        </div>
        <Field label="Signature Image (optional)">
          <div className="flex items-center gap-4">
            {form.signatorySignature ? (
              <img src={form.signatorySignature} alt="Signatory signature" className="h-14 w-auto object-contain border border-[var(--border)] rounded-lg p-1.5 bg-white" />
            ) : (
              <div className="h-14 w-32 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center text-xs text-slate-400">No signature</div>
            )}
            {auth.isAdmin && (
              <div className="flex gap-2">
                <label className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-slate-50 transition cursor-pointer">
                  Upload
                  <input type="file" accept="image/*" onChange={onSignaturePicked} className="hidden" />
                </label>
                {form.signatorySignature && <button onClick={()=>set('signatorySignature',null)} className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">Remove</button>}
              </div>
            )}
          </div>
        </Field>
        {auth.isAdmin && <button onClick={save} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-medium transition">Save Signatory</button>}
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


function UsersSettings() {
  const auth = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
        <div className="font-display text-[var(--navy-deep)]">Users & Roles</div>
        {auth.isAdmin && <button onClick={()=>setShowForm(true)} className="px-4 py-2 sos-btn-cyan rounded-lg text-sm font-medium transition">+ New User</button>}
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
                <td className="py-3 px-4"><Badge status="active" /></td>
                <td className="py-3 px-4 space-x-3 whitespace-nowrap">
                  {auth.isAdmin && u.id !== auth.user.id && <button onClick={()=>setDeleteTarget(u)} className="text-xs text-red-500 hover:underline">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!auth.isAdmin && <div className="text-xs text-slate-400 mt-3">Only admins can manage users in this prototype.</div>}
      {showForm && <UserFormModal onClose={()=>setShowForm(false)} onDone={(u)=>{ setShowForm(false); setNewUser(u); load(); }} />}
      {newUser && <NewUserCreatedModal result={newUser} onClose={()=>setNewUser(null)} />}
      <ConfirmModal open={!!deleteTarget} onClose={()=>setDeleteTarget(null)} onConfirm={confirmDelete} title="Remove User" message={deleteTarget ? `Remove ${deleteTarget.name} (${deleteTarget.email})? They will no longer be able to log in.` : ''} confirmLabel="Remove" danger />
    </div>
  );
}

function NewUserCreatedModal({ result, onClose }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Email: ${result.email}\nTemporary password: ${result.tempPassword}`);
      toast.push('Login details copied.', 'success');
    } catch (e) {
      toast.push('Could not copy automatically — copy manually.', 'error');
    }
  };
  return (
    <Modal open onClose={onClose} title="User Created" footer={
      <React.Fragment>
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Done</button>
        <button onClick={copy} className="px-4 py-2 text-sm rounded-lg sos-btn-cyan font-medium" style={{ WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>Copy Details</button>
      </React.Fragment>
    }>
      <p className="text-sm text-slate-600 mb-3">The account has been created and an email with these login details was sent to <strong>{result.email}</strong>. In case the email doesn't arrive, share this temporary password securely — they should change it after first sign-in.</p>
      <div className="bg-slate-50 rounded-lg p-3 text-sm border border-[var(--border)]">
        <div className="mb-1"><span className="text-slate-500">Email:</span> <span className="font-medium">{result.email}</span></div>
        <div><span className="text-slate-500">Temporary password:</span> <span className="font-data font-semibold">{result.tempPassword}</span></div>
      </div>
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
      <p className="text-xs text-slate-500 mb-4">The new user gets an email with their login details and a temporary password. You'll also see the password here in case the email doesn't arrive.</p>
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
    analysisTeams: pick(c, 'analysisTeams', 'analysis_teams') || [],
    oppMatchFootage: pick(c, 'oppMatchFootage', 'opp_match_footage') || false,
    oppTeamAnalysis: pick(c, 'oppTeamAnalysis', 'opp_team_analysis') || false,
    oppPlayerAnalysis: pick(c, 'oppPlayerAnalysis', 'opp_player_analysis') || false,
    billingBasis: pick(c, 'billingBasis', 'billing_basis') || 'services',
    paymentModel: pick(c, 'paymentModel', 'payment_model') || null,
    playerCount: pick(c, 'playerCount', 'player_count'),
    playerMonthlyFee: pick(c, 'playerMonthlyFee', 'player_monthly_fee'),
    playerMonths: pick(c, 'playerMonths', 'player_months'),
    kickbackPct: pick(c, 'kickbackPct', 'kickback_pct'),
    minPlayers: pick(c, 'minPlayers', 'min_players'),
    expectedPlayers: pick(c, 'expectedPlayers', 'expected_players'),
    clubFixedFee: pick(c, 'clubFixedFee', 'club_fixed_fee'),
    slaBands: pick(c, 'slaBands', 'sla_bands') || [],
    slaHours: pick(c, 'slaHours', 'sla_hours'),
    documentHashBefore: pick(c, 'documentHashBefore', 'document_hash_before'),
    createdAt: pick(c, 'createdAt', 'created_at'),
    sentAt: pick(c, 'sentAt', 'sent_at'),
    // Frozen payment schedule (snake or camel), mapped for the Fees table.
    payments: (Array.isArray(c?.payments) ? c.payments : []).map(p => ({
      dueDate: pick(p, 'dueDate', 'due_date'),
      amount: pick(p, 'amount'),
      totalAmount: pick(p, 'totalAmount', 'total_amount'),
    })),
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
    logoBase64: pick(cl, 'logoBase64', 'logo_url'),
  };
  const company = {
    name: pick(co, 'name'),
    logo: pick(co, 'logo', 'logo_url'),
    registeredAddress: pick(co, 'registeredAddress', 'registered_address'),
    contactEmail: pick(co, 'contactEmail', 'contact_email'),
    vatNumber: pick(co, 'vatNumber', 'vat_number'),
    registrationNumber: pick(co, 'registrationNumber', 'registration_number'),
    // Bank details — without these the review PDF's bank-details box was
    // silently dropped while the signed PDF showed it (they read the SAME
    // snapshot but the normalizer omitted the bank fields).
    bankName: pick(co, 'bankName', 'bank_name'),
    bankIBAN: pick(co, 'bankIBAN', 'bank_iban'),
    bankSWIFT: pick(co, 'bankSWIFT', 'bank_swift'),
    signatoryName: pick(co, 'signatoryName', 'signatory_name'),
    signatoryTitle: pick(co, 'signatoryTitle', 'signatory_title'),
    signatorySignature: pick(co, 'signatorySignature', 'signatory_signature'),
  };
  return { contract, client, company };
}

// Inline panel shown on the review/summary screens when a signer chooses to
// decline the contract or request changes. Reason is optional.
function DeclinePanel({ reason, setReason, onCancel, onConfirm, busy }) {
  return (
    <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-4">
      <div className="text-sm font-medium text-amber-800 mb-1">Decline or request changes</div>
      <p className="text-xs text-amber-700 mb-3">Let the sender know why you can't sign, or what needs to change. They'll be notified and can send you a revised contract.</p>
      <Field label="Reason for declining or changes requested (optional)">
        <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3} className={`${inputCls(false)} resize-none`} placeholder="e.g. Please update the start date, or the value needs revising." />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-white">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50">{busy ? 'Submitting…' : 'Confirm decline'}</button>
      </div>
    </div>
  );
}

// Compact "Why Science of Sports" trust panel — a few credibility points to
// reassure a nervous signer. Approved credentials only (no sales language).
// A calm vertical list reads more easily than a cramped row of pills.
function TrustPanel() {
  const points = [
    ['🏆', 'Official CFA Partner'],
    ['⚽', '3,000+ players profiled'],
    ['📊', '1,000+ matches analysed every year'],
  ];
  return (
    <div className="rounded-lg mb-6 px-4 py-3" style={{ background:'rgba(10,26,63,0.04)', border:'1px solid var(--border)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color:'var(--navy-deep)' }}>Why Science of Sports</div>
      <ul className="space-y-1.5">
        {points.map(([icon, label]) => (
          <li key={label} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">{icon}</span>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Compact 4-step progress indicator for the signing card. The signer confirms
// their own details BEFORE reviewing the document, so the document they attest
// to reading already reflects their corrections (Verify · Confirm · Review · Sign).
function SigningSteps({ current }) {
  const steps = ['Verify', 'Confirm', 'Review', 'Sign'];
  return (
    <div className="flex items-center justify-center gap-2 px-8 pt-5 pb-1">
      {steps.map((label, i) => {
        const step = i + 1;
        const isCurrent = step === current;
        const isDone = step < current;
        return (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${isCurrent ? 'bg-[var(--cyan)] text-[var(--navy-deep)]' : isDone ? 'bg-[var(--navy-deep)] text-white' : 'bg-slate-200 text-slate-400'}`}>
                {isDone ? '✓' : step}
              </span>
              <span className={`text-[11px] font-medium ${isCurrent ? 'text-[var(--navy-deep)]' : isDone ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
            </div>
            {step < steps.length && <span className="w-4 h-px bg-slate-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
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
  const [readConfirmed, setReadConfirmed] = useState(false);
  const scrollRef = useRef(null);

  const [sigName, setSigName] = useState('');
  const [sigTitle, setSigTitle] = useState('');
  const [sigCompany, setSigCompany] = useState('');
  const [typedSig, setTypedSig] = useState('');
  // Signature capture mode: 'type' | 'draw' | 'upload' (three mutually-exclusive choices).
  // Signature capture mode. Default to 'type' — the easiest, most reliable
  // option for a signer on any device (drawing is fiddly on a trackpad/phone).
  const [sigMode, setSigMode] = useState('type');
  const useTyped = sigMode === 'type';
  // Uploaded signature image (base64 data URL) when sigMode === 'upload'.
  const [uploadedSigDataUrl, setUploadedSigDataUrl] = useState(null);
  const [uploadedSigName, setUploadedSigName] = useState('');
  const sigFileInputRef = useRef(null);
  const [consents, setConsents] = useState({ authorized:false, read:false, electronic:false });
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [formErrors, setFormErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [signedResult, setSignedResult] = useState(null);

  const [clientDetailsForm, setClientDetailsForm] = useState(null);
  const [savingClientDetails, setSavingClientDetails] = useState(false);
  // Combined validation errors for the "Confirm Agreement Summary" step
  // (company details + designated contact + finance) — all mandatory.
  const [confirmErrors, setConfirmErrors] = useState({});

  // Client-provided designated contact person + finance contact (captured on
  // screen 3, stored on the contract via record-signature). Session-only state.
  const [contactForm, setContactForm] = useState({ contactName:'', contactRole:'', contactEmail:'', contactPhone:'', financeName:'', financeEmail:'' });
  const setContact = (k,v) => setContactForm(f=>({...f,[k]:v}));

  // Decline / request changes (server mode) + certificate re-download.
  const [declined, setDeclined] = useState(false);
  const [showDeclinePanel, setShowDeclinePanel] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningBusy, setDecliningBusy] = useState(false);

  const downloadCertificate = async () => {
    try {
      const res = await signingService.getCertificate(reqToken);
      window.open(res.downloadUrl, '_blank');
    } catch (err) {
      toast.push(err.message || 'Could not download your certificate.', 'error');
    }
  };

  // Re-download the fully-signed contract PDF (both parties' signatures).
  const downloadSignedContract = async () => {
    try {
      const res = await signingService.getSignedContract(reqToken);
      window.open(res.downloadUrl, '_blank');
    } catch (err) {
      toast.push(err.message || 'Could not download the signed contract.', 'error');
    }
  };

  const submitDecline = async () => {
    setDecliningBusy(true);
    try {
      await signingService.decline(reqToken, declineReason.trim());
      setShowDeclinePanel(false);
      setDeclined(true);
    } catch (err) {
      toast.push(err.message || 'Could not submit your response.', 'error');
    } finally {
      setDecliningBusy(false);
    }
  };

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

  // Validate + persist the company details AND designated/finance contacts, then
  // advance to the signature screen. All fields are mandatory before continuing.
  const continueToSignature = async () => {
    const cd = clientDetailsForm || {};
    const e = {};
    // Client company details — all required.
    if (!cd.companyName || !cd.companyName.trim()) e.companyName = 'Company name is required.';
    if (!cd.address || !cd.address.trim()) e.address = 'Registered address is required.';
    if (!cd.vatNumber || !cd.vatNumber.trim()) e.vatNumber = 'VAT number is required.';
    if (!cd.registrationNumber || !cd.registrationNumber.trim()) e.registrationNumber = 'Registration number is required.';
    // Designated contact — all required.
    if (!contactForm.contactName.trim()) e.contactName = 'Contact name is required.';
    if (!contactForm.contactRole.trim()) e.contactRole = 'Role is required.';
    if (!contactForm.contactPhone.trim()) e.contactPhone = 'Phone is required.';
    if (!contactForm.contactEmail.trim()) e.contactEmail = 'Email is required.';
    else if (!validateEmail(contactForm.contactEmail)) e.contactEmail = 'Enter a valid email.';
    // Finance contact — name + email required.
    if (!contactForm.financeName.trim()) e.financeName = 'Finance name is required.';
    if (!contactForm.financeEmail.trim()) e.financeEmail = 'Finance email is required.';
    else if (!validateEmail(contactForm.financeEmail)) e.financeEmail = 'Enter a valid email.';
    setConfirmErrors(e);
    if (Object.keys(e).length) return;

    setSavingClientDetails(true);
    try {
      // Portable AND server mode: the signer has no DB auth, so edits are
      // session-only — they display on screen but don't write the client record.
      if (isPortable || isServer) {
        const updated = { ...client, companyName: cd.companyName.trim(), address: cd.address.trim(), vatNumber: cd.vatNumber.trim(), registrationNumber: cd.registrationNumber.trim() };
        setClient(updated);
        setSigCompany(updated.companyName);
      } else {
        const updated = await clientService.update(client.id, {
          companyName: cd.companyName.trim(),
          address: cd.address.trim(),
          vatNumber: cd.vatNumber.trim(),
          registrationNumber: cd.registrationNumber.trim(),
        });
        setClient(updated);
        setSigCompany(updated.companyName);
        await contractService.addAuditEntry(contract.id, { type:'client_update', message:`Client updated their company details via the signing link (${updated.companyName})`, by: null });
      }
      // Details confirmed — now show the document (rebuilt with the corrected
      // client details) for review before signing.
      setScreen(2);
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

  // Server mode: the signer declined / requested changes.
  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--navy-deep)] px-4">
        <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md text-center">
          <div className="text-4xl mb-4">✋</div>
          <div className="font-heading mb-2">You've declined this contract.</div>
          <p className="text-sm text-slate-500">{company ? `${company.name} has been notified.` : 'The sender has been notified.'}</p>
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
          <p className="text-sm text-slate-500 mb-5">{company ? `Contact ${company.contactEmail} if you need another copy.` : 'Contact the sender if you need another copy.'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" onClick={downloadSignedContract} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium sos-btn-cyan">⬇ Download signed contract (PDF)</button>
            <button type="button" onClick={downloadCertificate} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-slate-50">⬇ Download certificate</button>
          </div>
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
    // Non-server: skip OTP, go straight to confirming the signer's own details.
    setScreen(3);
  };

  // SERVER MODE: verify the emailed 6-digit code, then confirm the signer's own
  // details BEFORE they review the document (so the reviewed copy is corrected).
  const verifyOtp = async () => {
    const code = otpCode.trim();
    if (code.length < 4) { setOtpError('Enter the code from your email.'); return; }
    setOtpBusy(true);
    try {
      await signingService.verifyOtp(reqToken, code);
      setOtpError('');
      setScreen(3);
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
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) setScrolledToBottom(true);
  };

  const startDraw = (e) => {
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX;
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY;
    ctx.beginPath(); ctx.moveTo(x,y);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * scaleX;
    const y = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) * scaleY;
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

  // UPLOAD MODE: read a picked image file as a base64 data URL for the signature.
  // Images only (JPG/PNG) so it stays compatible with the PNG-embedding certificate.
  const onSigFilePicked = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.push('Please upload an image (JPG or PNG) of your signature or signed page.', 'error');
      if (sigFileInputRef.current) sigFileInputRef.current.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.push('That image is too large (max 3MB). Please upload a smaller JPG or PNG.', 'error');
      if (sigFileInputRef.current) sigFileInputRef.current.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedSigDataUrl(reader.result);
      setUploadedSigName(file.name);
    };
    reader.onerror = () => {
      toast.push('Could not read that file. Please try another image.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const allConsentsChecked = consents.authorized && consents.read && consents.electronic;
  const hasSignature = sigMode === 'type'
    ? typedSig.trim().length > 0
    : sigMode === 'upload'
      ? !!uploadedSigDataUrl
      : !canvasEmpty;

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

      // Client-provided contact people (blanks -> null; guard emails).
      const clean = (v) => { const t = (v || '').trim(); return t || null; };
      const cleanEmail = (v) => { const t = (v || '').trim(); return t && validateEmail(t) ? t : null; };
      const contactPayload = {
        contactName: clean(contactForm.contactName),
        contactRole: clean(contactForm.contactRole),
        contactEmail: cleanEmail(contactForm.contactEmail),
        contactPhone: clean(contactForm.contactPhone),
        financeName: clean(contactForm.financeName),
        financeEmail: cleanEmail(contactForm.financeEmail),
      };
      // Reflect the captured contact + signer details on the in-memory contract
      // so the executed document (ContractDocumentBody / downloaded PDF) shows
      // the Designated Contact block AND fills the CLIENT signature column.
      setContract(c => ({
        ...(c || {}), ...contactPayload,
        signedAt, signerName: sigName, signerTitle: sigTitle, signerCompany: sigCompany,
      }));

      // CAPTURE THE SIGNATURE as a data URL (typed name, drawn canvas, or uploaded image).
      let signatureImageBase64 = null;
      if (sigMode === 'upload') {
        // Use the uploaded image (JPG/PNG data URL) directly.
        signatureImageBase64 = uploadedSigDataUrl;
      } else if (useTyped) {
        // Render the typed name onto an offscreen canvas in a cursive-ish font.
        // Auto-shrink the font so ANY length of name fits fully within the canvas
        // (and therefore within the certificate's signature box) — a long name
        // must never be clipped. Text is centred.
        const tmp = document.createElement('canvas');
        tmp.width = 460; tmp.height = 140;
        const tctx = tmp.getContext('2d');
        tctx.fillStyle = '#ffffff';
        tctx.fillRect(0, 0, tmp.width, tmp.height);
        tctx.fillStyle = '#0f172a';
        const name = typedSig.trim();
        const maxTextW = tmp.width - 40;   // 20px padding each side
        let fontSize = 40;
        do {
          tctx.font = `${fontSize}px "Segoe Script", "Brush Script MT", cursive`;
          if (tctx.measureText(name).width <= maxTextW) break;
          fontSize -= 2;
        } while (fontSize > 14);
        tctx.textBaseline = 'middle';
        tctx.textAlign = 'center';
        tctx.fillText(name, tmp.width / 2, tmp.height / 2);
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
          ...contactPayload,
          // Client's confirmed company details (address, VAT, reg) so the final
          // signed document reflects what the signer confirmed, not the blanks.
          clientDetails: clientDetailsForm ? {
            companyName: (clientDetailsForm.companyName || '').trim() || null,
            address: (clientDetailsForm.address || '').trim() || null,
            vatNumber: (clientDetailsForm.vatNumber || '').trim() || null,
            registrationNumber: (clientDetailsForm.registrationNumber || '').trim() || null,
          } : null,
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
        // NOTE: this local/demo fallback does NOT set documentHashAfter — the
        // real evidence hash is the server's full canonical hashDocument (set by
        // the record-signature Edge Function). Writing the old 3-field
        // sha256(title+description+value) here would never equal the canonical
        // document_hash_before and would show a false integrity difference.
        consentElectronic: consents.electronic, consentAuthorized: consents.authorized, consentRead: consents.read,
        ...contactPayload,
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

  const trustLine = (
    <p className="text-xs text-slate-400 mt-6 text-center">
      🔒 Secure &amp; encrypted · Identity verified by email{company?.contactEmail ? <> · Questions? {company.contactEmail}</> : null}
    </p>
  );
  const cardFooter = (
    <div className="border-t border-[var(--border)] px-8 py-3 text-center text-[11px] text-slate-400">
      Transforming matches into knowledge.
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--navy-deep)] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-4 mb-2">
            <img src="Logo-scios-dark.png" alt="Science of Sports" className="h-10 w-auto object-contain" />
            {client?.logoBase64 && (
              <React.Fragment>
                <span className="text-[var(--cyan)] text-lg">×</span>
                <img src={client.logoBase64} alt={client.companyName} className="h-10 w-auto object-contain" />
              </React.Fragment>
            )}
          </div>
          <div className="text-white font-display">SCIOS Contracts</div>
          <div className="text-slate-400 text-xs mt-1">Secure Electronic Signature</div>
          {client?.companyName && <div className="text-[var(--cyan)] text-xs mt-1">Prepared for {client.companyName}</div>}
        </div>

        {expired ? (
          <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
            <div className="text-4xl mb-4">⏰</div>
            <div className="font-heading mb-2">This signing link has expired</div>
            <p className="text-sm text-slate-500">Please contact {company.contactEmail} to request a new signing link.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="sos-rainbow" />
            {(screen === 1 || screen === 6 || screen === 2 || screen === 3 || screen === 4) && (
              <SigningSteps current={screen === 6 ? 1 : screen === 3 ? 2 : screen === 2 ? 3 : screen === 4 ? 4 : 1} />
            )}
            {screen === 1 && (
              <div className="p-8">
                <div className="font-heading mb-1">You have been invited to sign a document</div>
                <p className="text-sm text-slate-500 mb-6">{company.name} has sent you a contract for electronic signature.</p>
                <div className="bg-slate-50 rounded-lg p-4 mb-6">
                  <div className="text-sm font-medium">{contract.title}</div>
                  <div className="text-xs text-slate-400 mt-1">From {company.name}</div>
                </div>
                <TrustPanel />
                <Field label="Confirm your email address to continue" required error={emailError}>
                  <input type="email" value={emailInput} onChange={e=>setEmailInput(e.target.value)} className={inputCls(emailError)} placeholder="you@yourclub.com" />
                </Field>
                <p className="text-xs text-amber-600 mb-4">This link expires on {fmtDate(linkExpiry.toISOString())}.</p>
                <button onClick={confirmIdentity} disabled={otpBusy} className="w-full py-2.5 sos-btn-cyan rounded-lg text-sm font-medium transition disabled:opacity-50">{otpBusy ? 'Sending code…' : 'Continue'}</button>
                {trustLine}
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
                <button onClick={verifyOtp} disabled={otpBusy} className="w-full py-2.5 sos-btn-cyan rounded-lg text-sm font-medium transition disabled:opacity-50 mb-4">{otpBusy ? 'Verifying…' : 'Verify'}</button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" onClick={()=>{ setOtpCode(''); setOtpError(''); setScreen(1); }} className="text-slate-500 hover:underline">Change email</button>
                  <button type="button" onClick={resendOtp} disabled={otpBusy} className="text-blue-600 hover:underline disabled:opacity-50">Resend code</button>
                </div>
                <p className="text-xs text-slate-400 mt-4 text-center">The code can take up to a minute to arrive — please check your spam folder too.</p>
              </div>
            )}

            {screen === 2 && (
              <div className="p-8">
                <div className="font-heading mb-4">Review Document</div>
                <div ref={scrollRef} onScroll={onScroll} className="border border-[var(--border)] rounded-lg p-5 h-[60vh] md:h-96 overflow-y-auto text-sm text-slate-600 mb-4 bg-white">
                  <ContractDocumentBody contract={contract} client={client} company={company} />
                  <p className="text-xs text-slate-400 mt-6">— End of document —</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                  <input type="checkbox" checked={readConfirmed} onChange={e=>setReadConfirmed(e.target.checked)} />
                  <span>I have read the full agreement</span>
                </label>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={()=>downloadContractPdf({ contract, client, company })} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">⬇ Download PDF</button>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={()=>setScreen(3)} className="px-4 py-2.5 text-sm rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50 transition">Back</button>
                    {isServer && <button type="button" onClick={()=>setShowDeclinePanel(true)} className="px-4 py-2.5 text-sm rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50 transition">Decline / Request changes</button>}
                    <button disabled={!(scrolledToBottom || readConfirmed)} onClick={()=>setScreen(4)} className="px-5 py-2.5 sos-btn-cyan rounded-lg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed">
                      {(scrolledToBottom || readConfirmed) ? 'Proceed to Sign' : 'Scroll to the bottom to continue'}
                    </button>
                  </div>
                </div>
                {trustLine}
                {isServer && showDeclinePanel && <DeclinePanel reason={declineReason} setReason={setDeclineReason} onCancel={()=>{ setShowDeclinePanel(false); setDeclineReason(''); }} onConfirm={submitDecline} busy={decliningBusy} />}
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

                <p className="text-xs text-slate-500 mt-4">Please confirm your company details and provide your contact people. All fields are required to proceed.</p>

                <div className="mt-4 border border-[var(--border)] rounded-lg p-4">
                  <div className="text-sm font-medium mb-3">Your Company Details</div>
                  <Field label="Company Name" required error={confirmErrors.companyName}>
                    <input value={clientDetailsForm.companyName} onChange={e=>setClientDetailsForm(f=>({...f,companyName:e.target.value}))} className={inputCls(confirmErrors.companyName)} />
                  </Field>
                  <Field label="Registered Address" required error={confirmErrors.address}>
                    <input value={clientDetailsForm.address} onChange={e=>setClientDetailsForm(f=>({...f,address:e.target.value}))} className={inputCls(confirmErrors.address)} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="VAT Number" required error={confirmErrors.vatNumber}>
                      <input value={clientDetailsForm.vatNumber} onChange={e=>setClientDetailsForm(f=>({...f,vatNumber:e.target.value}))} className={inputCls(confirmErrors.vatNumber)} />
                    </Field>
                    <Field label="Registration Number" required error={confirmErrors.registrationNumber}>
                      <input value={clientDetailsForm.registrationNumber} onChange={e=>setClientDetailsForm(f=>({...f,registrationNumber:e.target.value}))} className={inputCls(confirmErrors.registrationNumber)} />
                    </Field>
                  </div>
                </div>

                <div className="mt-4 border border-[var(--border)] rounded-lg p-4">
                  <div className="text-sm font-medium mb-1">Your Designated Contact Person</div>
                  <p className="text-xs text-slate-500 mb-3">Please provide the main person we'll coordinate with for operations and communication, and your finance contact for invoicing.</p>
                  <Field label="Contact Name" required error={confirmErrors.contactName}>
                    <input value={contactForm.contactName} onChange={e=>setContact('contactName', e.target.value)} className={inputCls(confirmErrors.contactName)} placeholder="e.g. Maria Georgiou" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Role / Position" required error={confirmErrors.contactRole}>
                      <input value={contactForm.contactRole} onChange={e=>setContact('contactRole', e.target.value)} className={inputCls(confirmErrors.contactRole)} placeholder="e.g. Technical Director" />
                    </Field>
                    <Field label="Phone" required error={confirmErrors.contactPhone}>
                      <input value={contactForm.contactPhone} onChange={e=>setContact('contactPhone', e.target.value)} className={inputCls(confirmErrors.contactPhone)} />
                    </Field>
                  </div>
                  <Field label="Email" required error={confirmErrors.contactEmail}>
                    <input type="email" value={contactForm.contactEmail} onChange={e=>setContact('contactEmail', e.target.value)} className={inputCls(confirmErrors.contactEmail)} placeholder="contact@yourclub.com" />
                  </Field>
                  <div className="mt-3 pt-3 border-t border-[var(--border)]">
                    <div className="text-xs font-medium text-slate-600 mb-2">Finance / Accounts Contact</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Name" required error={confirmErrors.financeName}>
                        <input value={contactForm.financeName} onChange={e=>setContact('financeName', e.target.value)} className={inputCls(confirmErrors.financeName)} />
                      </Field>
                      <Field label="Email" required error={confirmErrors.financeEmail}>
                        <input type="email" value={contactForm.financeEmail} onChange={e=>setContact('financeEmail', e.target.value)} className={inputCls(confirmErrors.financeEmail)} placeholder="finance@yourclub.com" />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between mt-6">
                  <div className="flex items-center gap-2">
                    {isServer && <button type="button" onClick={()=>setShowDeclinePanel(true)} className="px-4 py-2.5 text-sm rounded-lg border border-[var(--border)] text-slate-600 hover:bg-slate-50 transition">Decline / Request changes</button>}
                  </div>
                  <button disabled={savingClientDetails} onClick={continueToSignature} className="px-5 py-2.5 sos-btn-cyan rounded-lg text-sm font-medium transition disabled:opacity-50">{savingClientDetails ? 'Saving…' : 'Continue to Review'}</button>
                </div>
                {isServer && showDeclinePanel && <DeclinePanel reason={declineReason} setReason={setDeclineReason} onCancel={()=>{ setShowDeclinePanel(false); setDeclineReason(''); }} onConfirm={submitDecline} busy={decliningBusy} />}
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
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[['type','Type'],['draw','Draw'],['upload','Upload']].map(([mode,label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={()=>setSigMode(mode)}
                        className={`py-2 text-sm rounded-lg border transition ${sigMode===mode ? 'bg-[var(--cyan)] text-[var(--navy-deep)] border-[var(--cyan)]' : 'border-[var(--border)] text-slate-600 hover:bg-slate-50'}`}
                      >{label}</button>
                    ))}
                  </div>

                  {sigMode === 'draw' && (
                    <div>
                      <canvas
                        ref={canvasRef} width={460} height={140}
                        className="border border-[var(--border)] rounded-lg w-full touch-none bg-white"
                        onMouseDown={startDraw} onMouseMove={moveDraw} onMouseUp={endDraw} onMouseLeave={endDraw}
                        onTouchStart={startDraw} onTouchMove={moveDraw} onTouchEnd={endDraw}
                      ></canvas>
                      <div className="mt-2">
                        <button type="button" onClick={clearCanvas} className="text-xs text-slate-500 hover:underline">Clear</button>
                      </div>
                    </div>
                  )}

                  {sigMode === 'type' && (
                    <div>
                      <input value={typedSig} onChange={e=>setTypedSig(e.target.value)} placeholder="Type your full name as signature" className={`${inputCls(formErrors.signature)} font-serif italic text-lg`} />
                    </div>
                  )}

                  {sigMode === 'upload' && (
                    <div>
                      <input ref={sigFileInputRef} type="file" accept="image/*" onChange={onSigFilePicked} className="hidden" />
                      {!uploadedSigDataUrl ? (
                        <button type="button" onClick={()=>sigFileInputRef.current && sigFileInputRef.current.click()} className="w-full border border-dashed border-[var(--border)] rounded-lg py-6 text-sm text-slate-500 hover:bg-slate-50">
                          Click to upload an image (JPG or PNG) of your signature or signed page
                        </button>
                      ) : (
                        <div>
                          <div className="border border-[var(--border)] rounded-lg p-3 bg-white flex items-center justify-center">
                            <img src={uploadedSigDataUrl} alt="Uploaded signature" className="max-h-32 w-auto object-contain" />
                          </div>
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-slate-400 truncate max-w-[60%]">{uploadedSigName}</span>
                            <button type="button" onClick={()=>{ setUploadedSigDataUrl(null); setUploadedSigName(''); if (sigFileInputRef.current) sigFileInputRef.current.value=''; }} className="text-xs text-slate-500 hover:underline">Remove</button>
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">Images only (JPG or PNG), max 3MB.</p>
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
                  <button onClick={()=>setScreen(2)} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-slate-50">Back</button>
                  <button disabled={!allConsentsChecked || !hasSignature || busy} onClick={submitSignature} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                    {busy ? 'Signing…' : 'Sign Agreement'}
                  </button>
                </div>
                {trustLine}
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
                  <React.Fragment>
                    <p className="text-sm text-slate-600 mb-4">Thank you — this contract is now signed. A confirmation email with your <strong>Certificate of Completion (PDF)</strong> has been sent to you. You can also download a copy of the agreement now:</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                      <button type="button" onClick={downloadSignedContract} className="px-4 py-2 rounded-lg text-sm font-medium sos-btn-cyan inline-flex items-center justify-center gap-1">⬇ Download signed contract (PDF)</button>
                      <button type="button" onClick={downloadCertificate} className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-slate-50 inline-flex items-center justify-center gap-1">⬇ Download certificate</button>
                    </div>
                  </React.Fragment>
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
            {cardFooter}
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
            <div className="text-white font-heading text-sm">SCIOS Contracts</div>
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
          <div className="text-white font-display">SCIOS Contracts</div>
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
