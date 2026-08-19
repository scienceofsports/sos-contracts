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


// Logos as inline base64 so the test needs no server. In the real app the club
// badge comes from the DB and the partner logo from public/CFCA-logo.png.
import { readFileSync as _rf } from 'node:fs';
const _b64 = (f) => 'data:image/png;base64,' + _rf(f).toString('base64');
const { generateContractPdf } = await import('../src/lib/contractPdf.js');

const company = {
  logo: _b64('public/Logo-scios-dark.png'),
  signatoryName: 'Κωνσταντίνος Χαραλαμπίδης',
  signatoryTitle: 'CEO',
  signatorySignature: _b64('public/signature-constantinos.png'),
  name: 'C.C. Science of Sports Ltd',
  registrationNumber: 'HE 449875',
  vatNumber: '',
  registeredAddress: 'Michalaki Karaoli, Anemomylos Building, Floor 5, 1095 Nicosia, Cyprus',
  bankName: 'Eurobank Limited', bankIBAN: 'CY61 0050 0109 0001 0901 H183 8501', bankSWIFT: 'HEBACY2N',
};

// A 2nd Division club — the contracts this work is aimed at. Greek club name
// on purpose: that alone would have been mojibake before the font swap.
const client = {
  companyName: '[Όνομα Σωματείου]',
  entityType: 'club',
  country: 'CY',
  registrationNumber: 'HE 654321',
  vatNumber: 'CY10654321Y',
  address: 'Λεωφόρος Αθαλάσσας 100, Λευκωσία',
};

const contract = {
  contractNumber: 'SOS-C-2026-TEST',
  title: '[Όνομα Σωματείου] — Συμφωνία Υπηρεσιών',
  contractKind: 'services',
  language: 'el',
  startDate: '2026-09-01',
  endDate: '2027-08-31',
  value: 2300,
  currency: 'EUR',
  governingLaw: 'the Republic of Cyprus',
  jurisdiction: 'Nicosia, Cyprus',
  paymentModel: 'club_funded',
  paymentType: 'milestone',
  extraSignatories: [{ organisation: 'Παγκύπριος Σύνδεσμος Προπονητών Ποδοσφαίρου', name: 'Μιχάλης Σεργίου', title: 'Πρόεδρος', signature: _b64('public/signature-sergiou.png'), date: '19/08/2026' }],
  partnerLogos: [{ name: 'Cyprus Football Coaches Association', logoBase64: _b64('public/CFCA-logo.png') }],
  discountAmount: 700,
  discountLabel: 'Έκπτωση συνεργασίας με τον Παγκύπριο Σύνδεσμο Προπονητών Ποδοσφαίρου',
  services: {
    platform_access: { selected: true, qty: 1, rate: 3000, directorSeats: 2, coachSeats: 5, playerSeats: 0 },
  },
  teamSla: { "Men's": 72 },
  payments: [
    { dueDate: '2026-09-02', amount: 1150, vatAmount: 218.5, totalAmount: 1368.5 },
    { dueDate: '2026-11-02', amount: 1150, vatAmount: 218.5, totalAmount: 1368.5 },
  ],
  specialTerms: JSON.stringify([
    { relatesTo: 'Fees & Payment', text: 'Η έκπτωση των €700 από τη συνεργασία του Παρόχου με τον Παγκύπριο Σύνδεσμο Προπονητών Ποδοσφαίρου αφορά τη σεζόν 2026/2027 και δεν μεταφέρεται αυτόματα σε επόμενη σεζόν.' },
    { relatesTo: 'Scope of Services', text: 'Η πρόσβαση παραχωρείται μόνο στον τεχνικό διευθυντή και στο προπονητικό επιτελείο. Οι παίκτες μπορούν να εγγραφούν ξεχωριστά με €150 ανά παίκτη τον χρόνο.' },
  ]),
};

const doc = await generateContractPdf({ contract, client, company });
writeFileSync('pdftest/sample-contract.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('wrote pdftest/sample-contract.pdf  (' + doc.getNumberOfPages() + ' pages)');
