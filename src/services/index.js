import { uuid, nowISO } from '../lib/format.js';
import { DB_KEYS, dbGet, dbSet } from './db.js';

/* =========================================================================
   SERVICE LAYER — all data access must go through these. Swap localStorage
   for API calls here later with zero UI changes.
   ========================================================================= */
export const companyService = {
  get: async () => dbGet(DB_KEYS.company, null),
  update: async (patch) => {
    const c = { ...dbGet(DB_KEYS.company, {}), ...patch };
    dbSet(DB_KEYS.company, c);
    return c;
  },
  clearClientsAndContracts: async () => {
    dbSet(DB_KEYS.clients, []);
    dbSet(DB_KEYS.contracts, []);
  },
};

export const userService = {
  getAll: async () => dbGet(DB_KEYS.users, []),
  getById: async (id) => dbGet(DB_KEYS.users, []).find(u => u.id === id) || null,
  getCurrentUser: async () => {
    const session = getSession();
    if (!session) return null;
    return dbGet(DB_KEYS.users, []).find(u => u.id === session.userId) || null;
  },
  login: async (email, password) => {
    const users = dbGet(DB_KEYS.users, []);
    const account = users.find(u => u.email.toLowerCase() === (email||'').toLowerCase());
    if (account && !account.password) throw new Error('This account has not completed setup yet. Use your setup link to create a password first.');
    const user = users.find(u => u.email.toLowerCase() === (email||'').toLowerCase() && u.password === password);
    if (!user) throw new Error('Invalid email or password.');
    const expiresAt = Date.now() + 8*60*60*1000;
    sessionStorage.setItem('sos_session', JSON.stringify({ userId: user.id, role: user.role, expiresAt }));
    return user;
  },
  logout: async () => { sessionStorage.removeItem('sos_session'); },
  create: async (data) => {
    const users = dbGet(DB_KEYS.users, []);
    if (users.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      throw new Error('A user with this email already exists.');
    }
    const setupTokenExpiry = new Date(); setupTokenExpiry.setDate(setupTokenExpiry.getDate() + 7);
    const user = {
      id: uuid(), createdAt: nowISO(), password: null,
      setupToken: uuid(), setupTokenExpiresAt: setupTokenExpiry.toISOString(),
      ...data,
    };
    users.push(user);
    dbSet(DB_KEYS.users, users);
    return user;
  },
  delete: async (id) => {
    const users = dbGet(DB_KEYS.users, []).filter(u => u.id !== id);
    dbSet(DB_KEYS.users, users);
  },
  getBySetupToken: async (token) => {
    const user = dbGet(DB_KEYS.users, []).find(u => u.setupToken === token);
    if (!user) return null;
    if (!user.setupTokenExpiresAt || new Date() > new Date(user.setupTokenExpiresAt)) return null;
    return user;
  },
  completeSetup: async (token, password) => {
    const users = dbGet(DB_KEYS.users, []);
    const idx = users.findIndex(u => u.setupToken === token);
    if (idx === -1) throw new Error('This setup link is invalid.');
    if (!users[idx].setupTokenExpiresAt || new Date() > new Date(users[idx].setupTokenExpiresAt)) throw new Error('This setup link has expired.');
    users[idx].password = password;
    users[idx].setupToken = null;
    users[idx].setupTokenExpiresAt = null;
    dbSet(DB_KEYS.users, users);
    return users[idx];
  },
};

export function getSession() {
  try {
    const raw = sessionStorage.getItem('sos_session');
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (Date.now() > session.expiresAt) { sessionStorage.removeItem('sos_session'); return null; }
    return session;
  } catch (e) { return null; }
}

export const clientService = {
  getAll: async () => dbGet(DB_KEYS.clients, []),
  getById: async (id) => dbGet(DB_KEYS.clients, []).find(c => c.id === id) || null,
  create: async (data) => {
    const clients = dbGet(DB_KEYS.clients, []);
    const client = { id: uuid(), createdAt: nowISO(), ...data };
    clients.push(client);
    dbSet(DB_KEYS.clients, clients);
    return client;
  },
  update: async (id, patch) => {
    const clients = dbGet(DB_KEYS.clients, []);
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Client not found');
    clients[idx] = { ...clients[idx], ...patch };
    dbSet(DB_KEYS.clients, clients);
    return clients[idx];
  },
};

export const contractService = {
  getAll: async () => dbGet(DB_KEYS.contracts, []),
  getById: async (id) => dbGet(DB_KEYS.contracts, []).find(c => c.id === id) || null,
  create: async (data) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const year = new Date().getFullYear();
    const seq = contracts.filter(c => c.contractNumber.includes(`-${year}-`)).length + 1;
    const contract = {
      id: uuid(),
      contractNumber: `SOS-C-${year}-${String(seq).padStart(3,'0')}`,
      version: 1, versionHistory: [], auditLog: [], payments: [],
      sentAt: null, sentBy: null,
      signerName: null, signerTitle: null, signerCompany: null, signerEmail: null,
      signedAt: null, signerIP: null,
      documentHashBefore: null, documentHashAfter: null,
      consentElectronic: false, consentAuthorized: false, consentRead: false,
      renewalStatus: null, renewalReminderSent: false,
      createdAt: nowISO(),
      ...data,
    };
    contract.auditLog.push({ id: uuid(), type: 'created', message: 'Contract created', at: nowISO(), by: data.createdBy });
    contracts.push(contract);
    dbSet(DB_KEYS.contracts, contracts);
    return contract;
  },
  update: async (id, patch) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    contracts[idx] = { ...contracts[idx], ...patch };
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx];
  },
  setAttachment: async (id, attachmentBase64, attachmentName) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    const previous = { ...contracts[idx] };
    contracts[idx] = { ...contracts[idx], attachmentBase64, attachmentName };
    try {
      dbSet(DB_KEYS.contracts, contracts);
    } catch (err) {
      dbSet(DB_KEYS.contracts, [...contracts.slice(0, idx), previous, ...contracts.slice(idx + 1)]);
      throw new Error('Could not save the file — your browser\'s local storage is full. Try a smaller file or remove an attachment from another contract first.');
    }
    return contracts[idx];
  },
  removeAttachment: async (id) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    contracts[idx] = { ...contracts[idx], attachmentBase64: null, attachmentName: null };
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx];
  },
  updateStatus: async (id, status, extra) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    contracts[idx] = { ...contracts[idx], status, ...(extra||{}) };
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx];
  },
  addAuditEntry: async (id, entry) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    contracts[idx].auditLog.push({ id: uuid(), at: nowISO(), ...entry });
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx];
  },
  addVersion: async (id, versionEntry) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Contract not found');
    contracts[idx].versionHistory.push(versionEntry);
    contracts[idx].version += 1;
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx];
  },
  delete: async (id) => {
    const contracts = dbGet(DB_KEYS.contracts, []).filter(c => c.id !== id);
    dbSet(DB_KEYS.contracts, contracts);
  },
};

export const paymentService = {
  getByContractId: async (contractId) => {
    const contract = await contractService.getById(contractId);
    return contract ? contract.payments : [];
  },
  getAllOutstanding: async () => {
    const contracts = await contractService.getAll();
    const out = [];
    contracts.forEach(c => c.payments.forEach(p => {
      if (p.status === 'pending' || p.status === 'overdue' || p.status === 'disputed') {
        out.push({ ...p, contractTitle: c.title, contractNumber: c.contractNumber, clientId: c.clientId });
      }
    }));
    return out;
  },
  create: async (contractId, data) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === contractId);
    if (idx === -1) throw new Error('Contract not found');
    const payment = { id: uuid(), contractId, status: 'pending', paidAt: null, paidAmount: null, markedPaidBy: null, remindersSent: [], notes: '', createdAt: nowISO(), ...data };
    contracts[idx].payments.push(payment);
    dbSet(DB_KEYS.contracts, contracts);
    return payment;
  },
  replaceAllForContract: async (contractId, paymentDataList) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const idx = contracts.findIndex(c => c.id === contractId);
    if (idx === -1) throw new Error('Contract not found');
    if (contracts[idx].payments.some(p => p.status !== 'pending' && p.status !== 'overdue')) {
      throw new Error('Cannot replace payment milestones once one has been paid or disputed.');
    }
    contracts[idx].payments = paymentDataList.map(data => ({
      id: uuid(), contractId, status: 'pending', paidAt: null, paidAmount: null, markedPaidBy: null, remindersSent: [], notes: '', createdAt: nowISO(), ...data,
    }));
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[idx].payments;
  },
  markPaid: async (contractId, paymentId, paidAmount, userId, paidAt) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const cidx = contracts.findIndex(c => c.id === contractId);
    if (cidx === -1) throw new Error('Contract not found');
    const pidx = contracts[cidx].payments.findIndex(p => p.id === paymentId);
    if (pidx === -1) throw new Error('Payment not found');
    contracts[cidx].payments[pidx] = {
      ...contracts[cidx].payments[pidx],
      status: 'paid', paidAt: paidAt || nowISO(), paidAmount, markedPaidBy: userId,
    };
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[cidx].payments[pidx];
  },
  updateStatus: async (contractId, paymentId, status) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const cidx = contracts.findIndex(c => c.id === contractId);
    if (cidx === -1) throw new Error('Contract not found');
    const pidx = contracts[cidx].payments.findIndex(p => p.id === paymentId);
    if (pidx === -1) throw new Error('Payment not found');
    contracts[cidx].payments[pidx].status = status;
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[cidx].payments[pidx];
  },
  addReminder: async (contractId, paymentId, reminder) => {
    const contracts = dbGet(DB_KEYS.contracts, []);
    const cidx = contracts.findIndex(c => c.id === contractId);
    if (cidx === -1) throw new Error('Contract not found');
    const pidx = contracts[cidx].payments.findIndex(p => p.id === paymentId);
    if (pidx === -1) throw new Error('Payment not found');
    contracts[cidx].payments[pidx].remindersSent.push({ id: uuid(), at: nowISO(), ...reminder });
    dbSet(DB_KEYS.contracts, contracts);
    return contracts[cidx].payments[pidx];
  },
};
