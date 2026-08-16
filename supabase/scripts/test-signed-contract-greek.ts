// The executed contract PDF is the document the CLIENT receives. Verify it
// builds with Greek party details — the Omonoia case.
import { buildContractPdf } from '../functions/_shared/contractPdf.ts';

const res = await buildContractPdf({
  snapshot: {
    contract: {
      title: 'Omonoia Aradippou — Performance Analysis Agreement',
      contractNumber: 'SOS-C-2026-005', value: 7000, currency: 'EUR',
      startDate: '2026-07-07', endDate: '2027-06-30', paymentType: 'installments',
    },
    client: {
      companyName: 'Omonoia Aradippou', contactName: 'ANTONIS PATSALOS',
      contactEmail: 'antonis_p13@yahoo.com', registrationNumber: 'ΗΕ265636',
      address: 'Αραδίππου, Λάρνακα, Κύπρος', country: 'CY',
    },
    company: {
      name: 'C.C. Science of Sports Ltd', registrationNumber: 'HE 449875',
      address: '2 Nikokreontos, Nice Dream, 6th Floor, Office 601, 1066 Nicosia, Cyprus',
      contactEmail: 'info@scienceofsports.net',
    },
  },
  signer: {
    name: 'ANTONIS PATSALOS', title: 'Πρόεδρος', company: 'Omonoia Aradippou',
    email: 'antonis_p13@yahoo.com', signedAt: '2026-07-30T13:27:09Z',
  },
  signatureImageBytes: null,
});
await Deno.writeFile('signed-contract-greek-test.pdf', res.bytes);
console.log('✅ Executed contract PDF built with Greek');
console.log('   bytes:', res.bytes.length, ' sha256:', res.sha256.slice(0, 16) + '…');
