// Smoke test: generate a Certificate + contract PDF containing Greek text.
// Run: npx deno run -A supabase/scripts/test-greek-pdf.ts
import { buildCertificate } from '../functions/_shared/certificate.ts';

const GREEK_CLUB = 'Ομόνοια Αραδίππου';
const GREEK_NAME = 'Αντώνης Παπαδόπουλος';
const GREEK_ADDR = 'Λεωφόρος Αρχ. Μακαρίου Γ΄ 12, Λάρνακα, Κύπρος';

const snapshot = {
  contract: {
    title: `${GREEK_CLUB} — Performance Analysis Agreement`,
    value: 7000, currency: 'EUR', startDate: '2026-07-07', endDate: '2027-06-30',
  },
  client: {
    companyName: GREEK_CLUB, contactName: GREEK_NAME,
    contactEmail: 'antonis_p13@yahoo.com', address: GREEK_ADDR,
    registrationNumber: 'ΗΕ 123456',
  },
  company: {
    name: 'C.C. Science of Sports Ltd', address: '2 Nikokreontos, Nice Dream, 6th Floor, Office 601, 1066 Nicosia, Cyprus',
    registrationNumber: 'HE 449875',
  },
};

const res = await buildCertificate({
  snapshot,
  signer: {
    name: GREEK_NAME, title: 'Πρόεδρος', company: GREEK_CLUB,
    email: 'antonis_p13@yahoo.com', ip: '82.102.0.1',
    userAgent: 'Mozilla/5.0', signedAt: new Date('2026-07-30T16:27:00Z').toISOString(),
    consentElectronic: true, consentAuthorized: true, consentRead: true,
  },
  documentHashBefore: 'a'.repeat(64),
  documentHashAfter: 'a'.repeat(64),
  integrityOk: true,
  signatureImageBytes: null,
  contractNumber: 'SOS-C-2026-005',
});

await Deno.writeFile('cert-greek-test.pdf', res.bytes);
console.log('✅ Certificate generated with Greek text');
console.log('   bytes:', res.bytes.length, ' sha256:', res.sha256.slice(0, 16) + '…');
