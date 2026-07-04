import { uuid, nowISO } from '../lib/format.js';
import { DB_KEYS, dbGet, dbSet } from './db.js';

/* =========================================================================
   SEED DATA
   ========================================================================= */
export function seedIfEmpty() {
  if (dbGet(DB_KEYS.seeded, false)) return;

  const company = {
    name: 'Your Company Ltd',
    registeredAddress: 'Enter your registered address in Settings',
    vatNumber: '',
    registrationNumber: '',
    contactEmail: 'contracts@example.com',
    website: 'www.example.com',
    bankName: '',
    bankIBAN: '',
    bankSWIFT: '',
    logo: null,
  };

  const users = [
    { id: uuid(), name: 'Constantinos Charalambides', email: 'admin@scienceofsports.com', password: 'Admin2026!', role: 'admin', createdAt: nowISO() },
    { id: uuid(), name: 'Board Viewer', email: 'viewer@scienceofsports.com', password: 'Viewer2026!', role: 'viewer', createdAt: nowISO() },
  ];

  const clients = [
    { id: uuid(), companyName: 'AEK Larnaca FC', contactName: 'Marios Georgiou', contactEmail: 'marios@aeklarnaca.com.cy', contactPhone: '+357 99 123456', address: 'Larnaca, Cyprus', country: 'CY', vatNumber: null, currency: 'EUR', createdAt: nowISO() },
    { id: uuid(), companyName: 'FC Metaframe Amsterdam', contactName: 'Jeroen de Vries', contactEmail: 'jeroen@metaframefc.nl', contactPhone: '+31 6 1234 5678', address: 'Amsterdam, Netherlands', country: 'NL', vatNumber: 'NL123456789B01', currency: 'EUR', createdAt: nowISO() },
    { id: uuid(), companyName: 'Al Fateh SC', contactName: 'Khalid Al-Otaibi', contactEmail: 'khalid@alfateh.sa', contactPhone: '+966 50 123 4567', address: 'Al Ahsa, Saudi Arabia', country: 'SA', vatNumber: null, currency: 'AED', createdAt: nowISO() },
  ];

  const c1Start = new Date(); c1Start.setMonth(c1Start.getMonth() - 6);
  const c1End = new Date(c1Start); c1End.setFullYear(c1End.getFullYear() + 1);
  const c2Sent = new Date(); c2Sent.setDate(c2Sent.getDate() - 3);
  const p1Due = new Date(); p1Due.setMonth(p1Due.getMonth() - 5);
  const p2Due = new Date(); p2Due.setDate(p2Due.getDate() + 10);
  const p3Due = new Date(); p3Due.setDate(p3Due.getDate() - 12);

  const contracts = [
    {
      id: uuid(), contractNumber: 'SOS-C-2026-001', clientId: clients[0].id,
      title: 'Full Platform & Scouting Access — AEK Larnaca FC',
      type: 'platform_subscription', status: 'active', value: 12000, currency: 'EUR',
      startDate: c1Start.toISOString(), endDate: c1End.toISOString(),
      paymentType: 'quarterly', paymentTermsDays: 30, latePaymentPenalty: 1.5,
      governingLaw: 'Republic of Cyprus', jurisdiction: 'Nicosia, Cyprus',
      description: 'Annual platform access including scouting reports, fitness data and match analysis for the first team squad.',
      templateId: null, attachmentBase64: null, attachmentName: null,
      version: 1, versionHistory: [],
      sentAt: c1Start.toISOString(), sentBy: users[0].id,
      signerName: 'Marios Georgiou', signerTitle: 'Sporting Director', signerCompany: 'AEK Larnaca FC', signerEmail: clients[0].contactEmail,
      signedAt: c1Start.toISOString(), signerIP: '94.65.12.101',
      documentHashBefore: 'seed-hash-before-1', documentHashAfter: 'seed-hash-before-1',
      consentElectronic: true, consentAuthorized: true, consentRead: true,
      auditLog: [
        { id: uuid(), type: 'created', message: 'Contract created', at: c1Start.toISOString(), by: users[0].id },
        { id: uuid(), type: 'sent', message: 'Contract sent to Marios Georgiou', at: c1Start.toISOString(), by: users[0].id },
        { id: uuid(), type: 'signed', message: 'Contract signed by Marios Georgiou', at: c1Start.toISOString(), by: null },
      ],
      payments: [
        { id: uuid(), contractId: null, accountingRef: 'SOS-2026-001', description: 'Q1 Platform Access Fee', dueDate: p1Due.toISOString(), amount: 3000, vatRate: 0.19, vatAmount: 570, totalAmount: 3570, currency: 'EUR', status: 'paid', paidAt: p1Due.toISOString(), paidAmount: 3570, markedPaidBy: users[0].id, remindersSent: [], notes: '', createdAt: c1Start.toISOString() },
        { id: uuid(), contractId: null, accountingRef: 'SOS-2026-002', description: 'Q2 Platform Access Fee', dueDate: p2Due.toISOString(), amount: 3000, vatRate: 0.19, vatAmount: 570, totalAmount: 3570, currency: 'EUR', status: 'pending', paidAt: null, paidAmount: null, markedPaidBy: null, remindersSent: [], notes: '', createdAt: nowISO() },
        { id: uuid(), contractId: null, accountingRef: 'SOS-2026-003', description: 'Q3 Platform Access Fee', dueDate: p3Due.toISOString(), amount: 3000, vatRate: 0.19, vatAmount: 570, totalAmount: 3570, currency: 'EUR', status: 'overdue', paidAt: null, paidAmount: null, markedPaidBy: null, remindersSent: [], notes: '', createdAt: nowISO() },
      ],
      renewalStatus: 'not_started', renewalReminderSent: false,
      createdAt: c1Start.toISOString(), createdBy: users[0].id,
    },
    {
      id: uuid(), contractNumber: 'SOS-C-2026-002', clientId: clients[1].id,
      title: 'Data License Agreement — FC Metaframe Amsterdam',
      type: 'data_license', status: 'sent', value: 18500, currency: 'EUR',
      startDate: new Date().toISOString(), endDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear()+1); return d.toISOString(); })(),
      paymentType: 'one_time', paymentTermsDays: 30, latePaymentPenalty: 1.5,
      governingLaw: 'Republic of Cyprus', jurisdiction: 'Nicosia, Cyprus',
      description: 'Licensing of match and fitness data feeds for the 2026/27 season, including API access.',
      templateId: null, attachmentBase64: null, attachmentName: null,
      version: 1, versionHistory: [],
      sentAt: c2Sent.toISOString(), sentBy: users[0].id,
      signerName: null, signerTitle: null, signerCompany: null, signerEmail: null,
      signedAt: null, signerIP: null,
      documentHashBefore: 'seed-hash-before-2', documentHashAfter: null,
      consentElectronic: false, consentAuthorized: false, consentRead: false,
      auditLog: [
        { id: uuid(), type: 'created', message: 'Contract created', at: c2Sent.toISOString(), by: users[0].id },
        { id: uuid(), type: 'sent', message: 'Contract sent to Jeroen de Vries', at: c2Sent.toISOString(), by: users[0].id },
      ],
      payments: [],
      renewalStatus: null, renewalReminderSent: false,
      createdAt: c2Sent.toISOString(), createdBy: users[0].id,
    },
    {
      id: uuid(), contractNumber: 'SOS-C-2026-003', clientId: clients[2].id,
      title: 'Consulting Engagement — Al Fateh SC Performance Review',
      type: 'consulting', status: 'draft', value: 9500, currency: 'AED',
      startDate: '', endDate: '',
      paymentType: 'milestone', paymentTermsDays: 15, latePaymentPenalty: 1.5,
      governingLaw: 'Republic of Cyprus', jurisdiction: 'Nicosia, Cyprus',
      description: 'One-off consulting engagement covering squad performance review and recommendations.',
      templateId: null, attachmentBase64: null, attachmentName: null,
      version: 1, versionHistory: [],
      sentAt: null, sentBy: null,
      signerName: null, signerTitle: null, signerCompany: null, signerEmail: null,
      signedAt: null, signerIP: null,
      documentHashBefore: null, documentHashAfter: null,
      consentElectronic: false, consentAuthorized: false, consentRead: false,
      auditLog: [ { id: uuid(), type: 'created', message: 'Contract created', at: nowISO(), by: users[0].id } ],
      payments: [],
      renewalStatus: null, renewalReminderSent: false,
      createdAt: nowISO(), createdBy: users[0].id,
    },
  ];
  contracts.forEach(c => c.payments.forEach(p => p.contractId = c.id));

  dbSet(DB_KEYS.company, company);
  dbSet(DB_KEYS.users, users);
  dbSet(DB_KEYS.clients, clients);
  dbSet(DB_KEYS.contracts, contracts);
  dbSet(DB_KEYS.seeded, true);
}
