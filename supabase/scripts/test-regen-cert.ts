// Verifies buildCertificate handles the REGENERATION path with Greek text —
// the exact Omonoia scenario. Run: npx deno run -A --no-check supabase/scripts/test-regen-cert.ts
import { buildCertificate } from '../functions/_shared/certificate.ts';

const signedAt = '2026-07-30T13:27:00Z';
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

const res = await buildCertificate({
  snapshot: {
    contract: { title: 'Ομόνοια Αραδίππου — Performance Analysis Agreement', value: 7000, currency: 'EUR', startDate: '2026-07-07', endDate: '2027-06-30' },
    client: { companyName: 'Ομόνοια Αραδίππου', contactName: 'ΑΝΤΩΝΗΣ ΠΑΤΣΑΛΟΣ', contactEmail: 'antonis_p13@yahoo.com', address: 'Αραδίππου, Λάρνακα, Κύπρος', registrationNumber: 'ΗΕ 123456' },
    company: { name: 'C.C. Science of Sports Ltd', address: '2 Nikokreontos, Nice Dream, 6th Floor, Office 601, 1066 Nicosia', registrationNumber: 'HE 449875' },
  },
  signer: {
    name: 'ANTONIS PATSALOS', title: 'Πρόεδρος', company: 'Ομόνοια Αραδίππου',
    email: 'antonis_p13@yahoo.com', ip: '82.102.0.1', userAgent: 'Mozilla/5.0',
    signedAt, consentElectronic: true, consentAuthorized: true, consentRead: true,
  },
  documentHashBefore: 'b'.repeat(64),
  documentHashAfter: 'b'.repeat(64),
  integrityOk: true,
  signatureImageBytes: null,
  contractNumber: 'SOS-C-2026-005',
  regeneratedNote: `The Certificate of Completion for this contract could not be produced at the time of signing because the document contained characters the PDF renderer could not encode. The signature itself completed normally and its evidence was recorded in the tamper-evident ledger at that moment and is reproduced above unchanged. This PDF was regenerated on ${stamp} from the frozen executed document stored at signing. The signature date shown above (${new Date(signedAt).toUTCString()}) is the original and authoritative one; only this PDF is of a later date.`,
});

await Deno.writeFile('regen-test.pdf', res.bytes);
console.log('✅ Regenerated certificate built with Greek + disclosure');
console.log('   bytes:', res.bytes.length, ' sha256:', res.sha256.slice(0, 16) + '…');
