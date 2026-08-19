/* Render a real contract PDF through the ACTUAL generator, so the font swap
   can be eyeballed without going through the signing/OTP flow.
   Run: node pdftest/render-sample.mjs   -> pdftest/sample-*.pdf            */
import { writeFileSync, readFileSync } from 'node:fs';

// The generator fetches its fonts over HTTP from /fonts. In Node there is no
// server, so shim fetch to read them off disk — the same bytes the browser
// would receive.
globalThis.fetch = async (url) => {
  const file = String(url).split('/').pop();
  const buf = readFileSync('public/fonts/' + file);
  return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};
// Vite's import.meta.env doesn't exist under plain Node.
process.env.BASE_URL = '/';

const { generateContractPdf } = await import('../src/lib/contractPdf.js');

const company = {
  name: 'C.C. Science of Sports Ltd',
  registrationNumber: 'HE 123456',
  vatNumber: 'CY10123456X',
  registeredAddress: 'Michalaki Karaoli 2, 1095 Nicosia, Cyprus',
  bankName: 'Bank of Cyprus', bankIBAN: 'CY00 0000 0000 0000', bankSWIFT: 'BCYPCY2N',
};

// A 2nd Division club — the contracts this work is aimed at. Greek club name
// on purpose: that alone would have been mojibake before the font swap.
const client = {
  companyName: 'ΑΠΟΕΛ Λευκωσίας',
  entityType: 'club',
  country: 'CY',
  registrationNumber: 'HE 654321',
  vatNumber: 'CY10654321Y',
  address: 'Λεωφόρος Αθαλάσσας 100, Λευκωσία',
};

const contract = {
  contractNumber: 'SOS-C-2026-TEST',
  title: 'ΑΠΟΕΛ Λευκωσίας — Services Agreement',
  contractKind: 'services',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  value: 2300,
  currency: 'EUR',
  governingLaw: 'the Republic of Cyprus',
  jurisdiction: 'Nicosia, Cyprus',
  paymentModel: 'club_funded',
  services: {
    platform_access: { selected: true, qty: 1, rate: 2300, directorSeats: 2, coachSeats: 5, playerSeats: 0 },
  },
  teamSla: { "Men's": 72 },
  payments: [
    { date: '2026-09-15', amount: 1368.5, totalAmount: 1368.5 },
    { date: '2026-11-15', amount: 1368.5, totalAmount: 1368.5 },
  ],
  specialTerms: JSON.stringify([
    { relatesTo: 'Fees & Payment', text: 'Greek check — Η ετήσια χρέωση ανέρχεται σε €3.000. Μέσω της συνεργασίας με τον Σύνδεσμο Προπονητών Κύπρου εφαρμόζεται έκπτωση €700, δίνοντας τελικό ποσό €2.300 πλέον ΦΠΑ.' },
    { relatesTo: 'Scope of Services', text: 'Accented forms — άέήίόύώ ΆΈΉΊΌΎΏ ϊϋΐΰ τελικό σίγμα: πρόσβασης. Σωματείο, Ανόρθωσις, Ολυμπιακός, ΚΟΠ.' },
  ]),
};

const doc = await generateContractPdf({ contract, client, company });
writeFileSync('pdftest/sample-contract.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('wrote pdftest/sample-contract.pdf  (' + doc.getNumberOfPages() + ' pages)');
