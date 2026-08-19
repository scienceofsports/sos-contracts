/* =========================================================================
   Generate one 2nd Division contract PDF per club.

   Every club signs the SAME programme on the SAME terms (€3,000 list, €700
   CFCA discount, €2,300 net, two instalments), but each gets its own document
   with its own contract number and its own badge — so no club ever sees
   another's copy.

   Run:  node pdftest/generate-div2.mjs
   Out:  pdftest/contracts/SOS-C-2026-0NN <club>.pdf
   ========================================================================= */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';

// jsPDF fetches its Unicode fonts over HTTP; in Node, serve them off disk.
globalThis.fetch = async (url) => {
  const name = String(url).split('/').pop();
  for (const dir of ['public/fonts/', 'public/']) {
    try {
      const buf = readFileSync(dir + name);
      return { ok: true, status: 200,
               arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    } catch (_) { /* try next */ }
  }
  return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
};

const { generateContractPdf } = await import('../src/lib/contractPdf.js');
const b64 = (f) => 'data:image/png;base64,' + readFileSync(f).toString('base64');

// --- The clubs. `logo` is the file in "Club Logos/"; `name` is what appears
// --- in the contract text and header.
const CLUBS = [
  { name: 'ΑΕΠ Πολεμιδιών',           logo: 'AEP Polemidion.png' },
  { name: 'Ακρίτας Χλώρακας',          logo: 'Akritas Chlorakas.png' },
  { name: 'Αναγέννηση Δερύνειας',      logo: 'Anagennisi.png' },
  { name: 'ΑΠΕΑ Ακρωτηρίου',           logo: 'APEA.png' },
  { name: 'Ασίλ Λύσης',                logo: 'ASIL.png' },
  { name: 'Αγία Νάπα',                 logo: 'Ayia Napa.png' },
  { name: 'Χαλκάνορας Ιδαλίου',        logo: 'Chalkanoras.png' },
  { name: 'Διγενής Μόρφου',            logo: 'Digenis.png' },
  { name: 'Δόξα Κατωκοπιάς',           logo: 'Doxa.png' },
  { name: 'Ένωσης Νέων Παραλιμνίου',   logo: 'ENP.png' },
  { name: 'Ερμής Αραδίππου',           logo: 'Ermis.jpg' },
  { name: 'Εθνικός Άχνας',             logo: 'Ethnikos Achnas.png' },
  { name: 'Ηρακλής Γερολάκκου',        logo: 'Iraklis.png' },
  { name: 'ΜΕΑΠ Πέρα-Χωρίου Νήσου',    logo: 'MEAP.png' },
  { name: 'ΠΑΕΕΚ Κερύνειας',           logo: 'PAEEK.png' },
  { name: 'Σπάρτακος Κιτίου',          logo: 'Spartakos.png' },
];

// --- Programme terms, identical for every club. ---------------------------
const LIST_PRICE = 3000;
const DISCOUNT   = 700;
const NET        = LIST_PRICE - DISCOUNT;          // 2300
const VAT        = Math.round(NET * 0.19 * 100) / 100;  // 437.00
const INSTALMENT = Math.round((NET + VAT) / 2 * 100) / 100;  // 1368.50

const company = {
  name: 'C.C. Science of Sports Ltd',
  registrationNumber: 'HE 449875',
  vatNumber: '',
  registeredAddress: 'Michalaki Karaoli, Anemomylos Building, Floor 5, 1095 Nicosia, Cyprus',
  contactEmail: 'info@scienceofsports.net',
  bankName: 'Eurobank Limited',
  bankIBAN: 'CY61 0050 0109 0001 0901 H183 8501',
  bankSWIFT: 'HEBACY2N',
  logo: b64('public/Logo-scios-dark.png'),
  signatoryName: 'Κωνσταντίνος Χαραλαμπίδης',
  signatoryTitle: 'CEO',
  signatorySignature: b64('public/signature-constantinos.png'),
};

const CFCA_LOGO = b64('public/CFCA-logo.png');
const CFCA_SIG  = b64('public/signature-sergiou.png');

const outDir = 'pdftest/contracts';
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// Contract numbers continue the live sequence rather than restarting at 001 —
// numbers up to 025 are already in use, so the division starts at 026.
const FIRST_NUMBER = 26;

let n = FIRST_NUMBER - 1;
for (const club of CLUBS) {
  n += 1;
  const contractNumber = `SOS-C-2026-${String(n).padStart(3, '0')}`;

  const client = {
    companyName: club.name,
    entityType: 'club',
    country: 'CY',
    logoBase64: b64('Club Logos/' + club.logo),
  };

  const contract = {
    contractNumber,
    title: `${club.name} — Συμφωνία Υπηρεσιών`,
    contractKind: 'services',
    language: 'el',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    value: NET,
    currency: 'EUR',
    governingLaw: 'the Republic of Cyprus',
    jurisdiction: 'Nicosia, Cyprus',
    paymentModel: 'club_funded',
    paymentType: 'milestone',
    discountAmount: DISCOUNT,
    discountLabel: 'Έκπτωση συνεργασίας με τον Παγκύπριο Σύνδεσμο Προπονητών Ποδοσφαίρου',
    partnerLogos: [{ name: 'Cyprus Football Coaches Association', logoBase64: CFCA_LOGO }],
    extraSignatories: [{
      organisation: 'Παγκύπριος Σύνδεσμος Προπονητών Ποδοσφαίρου',
      name: 'Μιχάλης Σεργίου',
      title: 'Πρόεδρος',
      signature: CFCA_SIG,
      date: '19/08/2026',
    }],
    services: {
      platform_access: { selected: true, qty: 1, rate: LIST_PRICE, directorSeats: 2, coachSeats: 5, playerSeats: 0 },
    },
    teamSla: { "Men's": 72 },
    payments: [
      { dueDate: '2026-09-02', amount: NET / 2, vatAmount: VAT / 2, totalAmount: INSTALMENT },
      { dueDate: '2026-11-02', amount: NET / 2, vatAmount: VAT / 2, totalAmount: INSTALMENT },
    ],
  };

  const doc = await generateContractPdf({ contract, client, company });
  // Keep the club name in the filename so the right PDF is easy to attach.
  const file = `${outDir}/${contractNumber} ${club.name}.pdf`;
  writeFileSync(file, Buffer.from(doc.output('arraybuffer')));
  console.log(`${contractNumber}  ${club.name}`);
}
console.log(`\n${CLUBS.length} contracts written to ${outDir}/`);
