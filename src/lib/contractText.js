/* =========================================================================
   CONTRACT DOCUMENT TEXT, BY LANGUAGE.

   One source of wording for all three renderers — ContractDocumentBody
   (App.jsx), the browser PDF (contractPdf.js) and the server PDF
   (_shared/contractPdf.ts). Before this file each of them carried its own
   inline copy of every clause, which is why the project rule is "edit all
   three together". Text added here is written ONCE and read by all of them.

   WHY GREEK EXISTS
   SCIOS sells the 2nd Division programme division-wide, on identical terms,
   to club chairmen and technical directors rather than to lawyers. An English
   document is a genuine obstacle to signing there. A Greek-language contract
   is fully enforceable under Cyprus law, so this is a presentation choice and
   not a legal compromise.

   THE GREEK IS SHORTER, NOT WEAKER
   The Greek text is deliberately plain and compact — short sentences, no
   archaic legal register, ~2 pages instead of ~4. What was cut is verbosity,
   NOT protection. Every operative promise survives:
     * GDPR: club = controller, SCIOS = processor, EEA transfer limits,
       deletion on termination, and the parental-consent duty for minors
       (SCIOS films youth football — this one is not optional).
     * IP: the club gets a perpetual licence to its own deliverables; SCIOS
       keeps its platform and the right to use anonymised aggregate data.
     * Liability: capped at 12 months' fees, with the carve-outs for
       confidentiality and data protection left intact.
     * Notice and cure periods, unchanged (3 months / 30 days).
   If you shorten this further, shorten the SENTENCES, not the promises.

   HOW TO USE
   `t(contract)` returns the dictionary for that contract's language, falling
   back to English for any key a translation is missing — so a partial
   translation degrades to a mixed document rather than to a blank one.
   ========================================================================= */

// Languages the document generators can render. Keep in step with the
// contracts_language_check constraint in migration 0027.
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'el', label: 'Greek', native: 'Ελληνικά' },
];

export function isGreek(contract) {
  return (contract?.language || 'en') === 'el';
}

/**
 * SHORT FORM — a commercial one-to-two-page agreement.
 *
 * Constantinos asked for the 2nd Division document to carry "only the most
 * important" terms: it is sold division-wide to club chairmen, and the full
 * legal tail was the obstacle. So the short form keeps WHAT THE DEAL IS
 * (services, fee, term, payment) and drops the standalone Confidentiality,
 * IP, Liability and Force Majeure sections, folding what remains into one
 * compact "Γενικοί Όροι" clause.
 *
 * ⚠️ THIS IS A DELIBERATE REDUCTION IN LEGAL PROTECTION, made by the business
 * owner with the trade-off stated. Two consequences to know before extending
 * this to other contracts:
 *   * There is no longer a liability cap, so exposure is not limited to the
 *     fees paid.
 *   * There is no standalone IP clause, so ownership of the footage and
 *     reports rests on the short line in the general terms.
 * The minors/GDPR line is retained: SCIOS films youth football, and a written
 * basis for processing children's data is a regulatory requirement, not
 * contract length. Do not remove it without a data-protection review.
 *
 * Tied to language for now because Greek is only used for the 2nd Division
 * programme. If a Greek FULL-form contract is ever needed, promote this to its
 * own contract field rather than inferring it from the language.
 */
export function isShortForm(contract) {
  return isGreek(contract);
}

/* -------------------------------------------------------------------------
   ENGLISH — the existing wording, unchanged. Moving it here must not alter a
   single character: contracts already sent are re-rendered from their frozen
   snapshot, but a DRAFT re-rendered after this change has to come out
   byte-identical to what it produced before.
   ------------------------------------------------------------------------- */
const EN = {
  // --- Document furniture -------------------------------------------------
  agreementMadeOn: 'This Agreement is made on',
  between: 'between:',
  and: 'and',
  partiesJointly: 'The above are hereinafter jointly referred to as the "Parties".',
  serviceProvider: 'Service Provider',
  client: 'Client',
  endOfDocument: '— End of document —',

  // --- Section headings ---------------------------------------------------
  s_about: 'About the Service Provider',
  s_purpose: 'Purpose',
  s_scope: 'Scope of Services',
  s_analysis: 'Scope of Analysis',
  s_fees: 'Fees & Payment',
  s_commercial: 'Commercial Terms & Club Commission',
  s_branding: 'Branding & Materials',
  s_serviceLevels: 'Service Levels',
  s_confidentiality: 'Confidentiality & Data Protection',
  s_ip: 'Intellectual Property Rights',
  s_duration: 'Duration',
  s_termination: 'Termination',
  s_liability: 'Limitation of Liability',
  s_forceMajeure: 'Force Majeure',
  s_governingLaw: 'Governing Law & Jurisdiction',
  s_specialTerms: 'Special Terms',
  s_entireAgreement: 'Entire Agreement & Amendments',
  s_signatures: 'Signatures',

  // --- Table / label furniture -------------------------------------------
  th_service: 'Service',
  th_amount: 'Amount',
  bankDetails: 'Bank Details (Service Provider)',
  accountName: 'Account Name',
  bank: 'Bank',
  iban: 'IBAN',
  swift: 'SWIFT/BIC',

  // --- Tail clauses -------------------------------------------------------
  liability: 'The Service Provider shall not be responsible for sporting results, team selection decisions, or competition outcomes. Total liability under this Agreement shall not exceed the fees paid during the preceding twelve (12) months. This limitation shall not apply to breaches of confidentiality, data protection obligations, or unauthorized use of the Client\'s data or intellectual property.',
  forceMajeure: 'Neither Party shall be liable for failure to perform due to events beyond reasonable control.',
  terminationNotice: 'Either Party may terminate this Agreement with three (3) months\' written notice, or immediately in the event of a material breach not remedied within thirty (30) days.',
  entireAgreement: 'This Agreement constitutes the entire agreement between the Parties. Any amendment must be made in writing and signed by both Parties.',
  reviewNote: 'This document is provided for review. To execute it, the Client signs electronically through the secure signing link. Upon signing, a Certificate of Completion containing the full signature evidence is issued to both parties.',

  // --- Purpose / scope prose ---------------------------------------------
  purposeIntro: 'The purpose of this Agreement is to define the terms of cooperation between the Parties, under which the Service Provider shall provide the Client with the following services:',
  totalContractValue: 'Total Contract Value (excl. VAT)',
  vatLine: 'VAT',
  totalInclVat: 'Total incl. VAT',
  th_payment: 'Payment',
  th_dueDate: 'Due Date',
  th_amountInclVat: 'Amount (incl. VAT)',
  instalment: 'Instalment',
  designatedContact: 'Designated Contact',
  bankDetailsHeading: 'BANK DETAILS (SERVICE PROVIDER)',
  reRef: 'Re:',
  regNoShort: 'Reg. No.',
  vatShort: 'VAT',
  executedBy: 'Executed by the duly authorised representatives of the Parties as of the dates set out below.',
  forAndOnBehalfOf: 'FOR AND ON BEHALF OF',
  sig_signature: 'SIGNATURE',
  sig_name: 'NAME',
  sig_title: 'TITLE',
  sig_date: 'DATE',
  closingTagline: 'Transforming matches into knowledge — together.',
  // --- Fees prose ---------------------------------------------------------
  feesShallPay: 'the Client shall pay the Service Provider a total of',
  feesExclVat: '(exclusive of VAT)',
  feesPayable: 'payable',
  vatAppliesSentence: 'The above amount is exclusive of VAT. VAT at',
  vatGivingTotal: 'applies, giving a total amount payable of',
  bankTransferSentence: 'All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider, in accordance with applicable VAT regulations.',
  scheduleTiming: ' in accordance with the payment schedule set out below.',
  advanceInvoice: 'The Service Provider shall issue a separate invoice for each instalment in advance of its due date.',
  netDaysPrefix: ', net',
  netDaysSuffix: 'days from the date of a valid invoice.',
  totalContractValuePlain: 'Total Contract Value',
  accessLabel: 'Access:',
  accessConfirm: '(exact users to be confirmed with the client).',
  accessConfirmNoStop: '(exact users to be confirmed with the client)',
  payWord_one_time: 'in a single payment',
  payWord_milestone: 'in instalments',
  payWord_monthly: 'monthly',
  payWord_quarterly: 'quarterly',
  payWord_annually: 'annually',
  forApplicableInstalment: ' for the applicable instalment',
  latePenaltyPrefix: ' A late payment penalty of',
  latePenaltySuffix: '% per month applies to overdue amounts.',
};

/* -------------------------------------------------------------------------
   GREEK — plain, short, and legally complete.

   Register notes for anyone editing:
     * Address the parties as «ο Πάροχος» / «ο Πελάτης», consistently.
     * Prefer everyday verbs to legal ones: «θα παρέχει», not «υποχρεούται
       όπως παρέχη».
     * Keep sentences under ~25 words. Split rather than sub-clause.
     * Money and dates stay in the same numeric format as the English
       document, so the two versions reconcile at a glance.
   ------------------------------------------------------------------------- */
const EL = {
  // --- Document furniture -------------------------------------------------
  agreementMadeOn: 'Η παρούσα Συμφωνία συνάπτεται στις',
  between: 'μεταξύ:',
  and: 'και',
  partiesJointly: 'Οι πιο πάνω αναφέρονται στο εξής από κοινού ως «τα Μέρη».',
  serviceProvider: 'Πάροχος',
  client: 'Πελάτης',
  endOfDocument: '— Τέλος εγγράφου —',

  // --- Section headings ---------------------------------------------------
  s_about: 'Σχετικά με τον Πάροχο',
  s_purpose: 'Αντικείμενο',
  s_scope: 'Υπηρεσίες',
  s_analysis: 'Ανάλυση',
  s_fees: 'Χρεώσεις & Πληρωμή',
  s_commercial: 'Εμπορικοί Όροι & Προμήθεια',
  s_branding: 'Προβολή & Υλικό',
  s_serviceLevels: 'Χρόνοι Παράδοσης',
  s_confidentiality: 'Εμπιστευτικότητα & Προσωπικά Δεδομένα',
  s_ip: 'Πνευματική Ιδιοκτησία',
  s_duration: 'Διάρκεια',
  s_termination: 'Λήξη & Καταγγελία',
  s_liability: 'Ευθύνη',
  s_forceMajeure: 'Ανωτέρα Βία',
  s_governingLaw: 'Εφαρμοστέο Δίκαιο',
  s_specialTerms: 'Ειδικοί Όροι',
  s_entireAgreement: 'Γενικοί Όροι',
  s_signatures: 'Υπογραφές',

  // --- Table / label furniture -------------------------------------------
  th_service: 'Υπηρεσία',
  th_amount: 'Ποσό',
  bankDetails: 'Τραπεζικά Στοιχεία (Πάροχος)',
  accountName: 'Δικαιούχος',
  bank: 'Τράπεζα',
  iban: 'IBAN',
  swift: 'SWIFT/BIC',

  // --- Tail clauses -------------------------------------------------------
  // Liability: the cap and BOTH carve-outs are preserved.
  liability: 'Ο Πάροχος δεν ευθύνεται για αγωνιστικά αποτελέσματα, για επιλογές της ομάδας ή για την πορεία σε οποιαδήποτε διοργάνωση. Η συνολική ευθύνη του Παρόχου δεν ξεπερνά τα ποσά που πληρώθηκαν τους τελευταίους δώδεκα (12) μήνες. Ο περιορισμός αυτός δεν ισχύει σε περίπτωση παραβίασης της εμπιστευτικότητας, των υποχρεώσεων προστασίας δεδομένων ή μη εγκεκριμένης χρήσης των δεδομένων ή της πνευματικής ιδιοκτησίας του Πελάτη.',
  forceMajeure: 'Κανένα Μέρος δεν ευθύνεται για μη εκπλήρωση που οφείλεται σε γεγονότα εκτός του εύλογου ελέγχου του.',
  terminationNotice: 'Κάθε Μέρος μπορεί να τερματίσει τη Συμφωνία με γραπτή ειδοποίηση τριών (3) μηνών. Σε περίπτωση ουσιώδους παράβασης που δεν διορθωθεί εντός τριάντα (30) ημερών, ο τερματισμός είναι άμεσος.',
  entireAgreement: 'Η παρούσα αποτελεί τη συνολική συμφωνία των Μερών. Κάθε τροποποίηση γίνεται γραπτώς και υπογράφεται και από τα δύο Μέρη.',
  reviewNote: 'Το έγγραφο αυτό παρέχεται για μελέτη. Για να τεθεί σε ισχύ, ο Πελάτης υπογράφει ηλεκτρονικά μέσω του ασφαλούς συνδέσμου. Με την υπογραφή, εκδίδεται σε αμφότερα τα Μέρη Πιστοποιητικό Ολοκλήρωσης με τα πλήρη στοιχεία της υπογραφής.',

  // --- Purpose / scope prose ---------------------------------------------
  purposeIntro: 'Με την παρούσα Συμφωνία, ο Πάροχος παρέχει στον Πελάτη τις πιο κάτω υπηρεσίες:',
  totalContractValue: 'Συνολική Αξία (χωρίς ΦΠΑ)',
  vatLine: 'ΦΠΑ',
  totalInclVat: 'Σύνολο με ΦΠΑ',
  th_payment: 'Πληρωμή',
  th_dueDate: 'Ημερομηνία',
  th_amountInclVat: 'Ποσό (με ΦΠΑ)',
  instalment: 'Δόση',
  designatedContact: 'Πρόσωπο Επικοινωνίας',
  bankDetailsHeading: 'ΤΡΑΠΕΖΙΚΑ ΣΤΟΙΧΕΙΑ (ΠΑΡΟΧΟΣ)',
  reRef: 'Σχετικά με:',
  regNoShort: 'Αρ. Εγγραφής',
  vatShort: 'ΑΦΤ',
  executedBy: 'Υπογράφεται από τους δεόντως εξουσιοδοτημένους εκπροσώπους των Μερών κατά τις πιο κάτω ημερομηνίες.',
  forAndOnBehalfOf: 'ΓΙΑ ΚΑΙ ΕΚ ΜΕΡΟΥΣ',
  sig_signature: 'ΥΠΟΓΡΑΦΗ',
  sig_name: 'ΟΝΟΜΑ',
  sig_title: 'ΘΕΣΗ',
  sig_date: 'ΗΜΕΡΟΜΗΝΙΑ',
  closingTagline: 'Μετατρέπουμε τους αγώνες σε γνώση — μαζί.',
  // --- Fees prose ---------------------------------------------------------
  feesShallPay: 'ο Πελάτης καταβάλλει στον Πάροχο συνολικά',
  feesExclVat: '(χωρίς ΦΠΑ)',
  feesPayable: 'πληρωτέα',
  vatAppliesSentence: 'Το πιο πάνω ποσό δεν περιλαμβάνει ΦΠΑ. Με ΦΠΑ',
  vatGivingTotal: 'το συνολικό πληρωτέο ποσό ανέρχεται σε',
  bankTransferSentence: 'Οι πληρωμές γίνονται με τραπεζικό έμβασμα, μετά την έκδοση έγκυρου τιμολογίου από τον Πάροχο και σύμφωνα με την ισχύουσα νομοθεσία ΦΠΑ.',
  scheduleTiming: ' σύμφωνα με το πρόγραμμα πληρωμών που ακολουθεί.',
  advanceInvoice: 'Ο Πάροχος εκδίδει ξεχωριστό τιμολόγιο για κάθε δόση πριν από την ημερομηνία της.',
  netDaysPrefix: ', εντός',
  netDaysSuffix: 'ημερών από την ημερομηνία έγκυρου τιμολογίου.',
  totalContractValuePlain: 'Συνολική Αξία',
  accessLabel: 'Πρόσβαση:',
  accessConfirm: '(οι ακριβείς χρήστες θα επιβεβαιωθούν με τον Πελάτη).',
  accessConfirmNoStop: '(οι ακριβείς χρήστες θα επιβεβαιωθούν με τον Πελάτη)',
  payWord_one_time: 'σε μία πληρωμή',
  payWord_milestone: 'σε δόσεις',
  payWord_monthly: 'μηνιαίως',
  payWord_quarterly: 'ανά τρίμηνο',
  payWord_annually: 'ετησίως',
  forApplicableInstalment: ' για την αντίστοιχη δόση',
  latePenaltyPrefix: ' Σε καθυστερημένα ποσά εφαρμόζεται προσαύξηση',
  latePenaltySuffix: '% τον μήνα.',
};

const DICTS = { en: EN, el: EL };

/**
 * Dictionary for a contract's language, with English as the per-key fallback
 * so a missing translation degrades to a mixed document rather than a blank.
 */
export function t(contract) {
  const dict = DICTS[contract?.language || 'en'] || EN;
  return new Proxy(dict, {
    get: (target, key) => (key in target ? target[key] : EN[key]),
  });
}

/* -------------------------------------------------------------------------
   Clause bodies that VARY by contract kind as well as language. These mirror
   confidentialityParas / ipParas / terminationEffectPara in constants.js —
   which remain the English source — and add the Greek equivalents.

   ⚠️ The services and sponsorship variants are NOT interchangeable. The
   services IP clause licenses the Deliverables (match footage, reports,
   clips) to the Client in perpetuity; rendering it on a sponsorship would
   hand a sponsor a perpetual licence over SCIOS's footage. See the project
   CLAUDE.md and [[sponsorship-clause-traps]].
   ------------------------------------------------------------------------- */

export const EL_CLAUSES = {
  // --- Confidentiality & GDPR --------------------------------------------
  confidentiality: {
    services: {
      lead: 'Εμπιστευτικότητα & GDPR.',
      paras: [
        'Ο Πάροχος επεξεργάζεται προσωπικά δεδομένα αποκλειστικά για τους σκοπούς της Συμφωνίας και σύμφωνα με τις γραπτές οδηγίες του Πελάτη, τον Κανονισμό (ΕΕ) 2016/679 (GDPR) και τον περί Προστασίας Δεδομένων Νόμο 125(Ι)/2018.',
        // The controller/processor split and the minors duty are the operative
        // parts of this clause — SCIOS films youth football, so the consent
        // obligation must sit visibly with the club.
        'Για τα δεδομένα αυτά, ο Πελάτης είναι ο υπεύθυνος επεξεργασίας και ο Πάροχος ο εκτελών την επεξεργασία. Ο Πάροχος τα χρησιμοποιεί μόνο όσο χρειάζεται για τις υπηρεσίες, τα τηρεί ασφαλή, δεν τα μεταφέρει εκτός ΕΟΧ χωρίς κατάλληλες εγγυήσεις, βοηθά τον Πελάτη σε αιτήματα προσώπων και τα διαγράφει ή τα επιστρέφει με τη λήξη. Όπου αφορούν ανηλίκους, ο Πελάτης εξασφαλίζει τις απαραίτητες συγκαταθέσεις γονέα ή κηδεμόνα.',
        'Όλες οι αναλύσεις, οι αναφορές, τα βίντεο και τα δεδομένα που παράγονται είναι εμπιστευτικά και χρησιμοποιούνται μόνο για τις εσωτερικές ανάγκες του Πελάτη.',
      ],
    },
    sponsorship: {
      lead: 'Εμπιστευτικότητα.',
      paras: [
        'Κάθε Μέρος τηρεί εμπιστευτικούς τους εμπορικούς όρους της Συμφωνίας και κάθε μη δημόσια πληροφορία του άλλου Μέρους, και δεν τα κοινοποιεί σε τρίτους χωρίς γραπτή συγκατάθεση, εκτός αν το επιβάλλει ο νόμος.',
        'Κάθε Μέρος ενεργεί ως ανεξάρτητος υπεύθυνος επεξεργασίας για όσα προσωπικά δεδομένα επεξεργάζεται στο πλαίσιο της Συμφωνίας και συμμορφώνεται με τον GDPR και τον Νόμο 125(Ι)/2018. Μεταξύ των Μερών δεν διαβιβάζονται προσωπικά δεδομένα πέραν των στοιχείων επικοινωνίας των εκπροσώπων τους.',
      ],
    },
  },

  // --- Intellectual property ---------------------------------------------
  ip: {
    services: [
      'Το υλικό που παράγεται για τον Πελάτη — βίντεο αγώνων, αναφορές, αναλύσεις και κλιπ (τα «Παραδοτέα») — προορίζεται για χρήση του Πελάτη. Ο Πάροχος παραχωρεί στον Πελάτη διαρκή, αμετάκλητη και χωρίς αντάλλαγμα άδεια να τα χρησιμοποιεί, να τα αναπαράγει και να τα αρχειοθετεί για τις δικές του ποδοσφαιρικές και λειτουργικές ανάγκες. Ο Πάροχος δεν τα κοινοποιεί σε τρίτους χωρίς γραπτή συγκατάθεση του Πελάτη, εκτός αν το επιβάλλει ο νόμος.',
      'Ο Πάροχος διατηρεί την πλήρη κυριότητα της πλατφόρμας, του λογισμικού, των μεθόδων και των προτύπων του. Μπορεί να κρατά εσωτερικά αντίγραφα των Παραδοτέων και να χρησιμοποιεί ανώνυμα και συγκεντρωτικά δεδομένα για συγκριτική αξιολόγηση, έρευνα και βελτίωση των υπηρεσιών του, εφόσον δεν ταυτοποιείται ο Πελάτης, οι παίκτες ή οι ομάδες του χωρίς τη συγκατάθεσή του.',
    ],
    sponsorship: [
      'Κάθε Μέρος διατηρεί την κυριότητα του ονόματος, των λογοτύπων και των σημάτων του. Κανένα Μέρος δεν αποκτά δικαίωμα στην πνευματική ιδιοκτησία του άλλου, πέραν των ρητών αδειών της Συμφωνίας, οι οποίες λήγουν αυτόματα με τη λήξη ή τον τερματισμό της.',
      'Ο Πάροχος διατηρεί την πλήρη κυριότητα του Αντικειμένου Χορηγίας και όλου του υλικού, του βίντεο, των αναφορών, της πλατφόρμας και του λογισμικού που συνδέονται με αυτό. Η Συμφωνία δεν παρέχει στον Πελάτη κανένα δικαίωμα χρήσης ή εκμετάλλευσης του υλικού αυτού πέραν των δικαιωμάτων χορηγίας που ρητά αναφέρονται.',
    ],
  },

  // --- Effect of termination ---------------------------------------------
  terminationEffect: {
    services: 'Με τη λήξη ή τον τερματισμό της Συμφωνίας, ο Πάροχος παραδίδει άμεσα στον Πελάτη όλα τα Παραδοτέα που έχουν παραχθεί.',
    sponsorship: 'Με τη λήξη ή τον τερματισμό της Συμφωνίας, τα δικαιώματα χορηγίας του Πελάτη παύουν και ο Πάροχος αφαιρεί το υλικό του Πελάτη εντός εύλογου χρόνου. Ποσά που αφορούν δικαιώματα τα οποία έχουν ήδη παρασχεθεί παραμένουν πληρωτέα, ενώ ποσά που προπληρώθηκαν για δικαιώματα που δεν παρασχέθηκαν επιστρέφονται.',
  },

  // Opening words of the Fees clause — a sponsorship buys RIGHTS, not services.
  feesConsideration: {
    services: 'Έναντι των υπηρεσιών που παρέχονται βάσει της παρούσας Συμφωνίας',
    sponsorship: 'Έναντι των δικαιωμάτων χορηγίας που παραχωρούνται βάσει της παρούσας Συμφωνίας',
  },
};

/**
 * The Duration sentence, which needs both a language and correct singular /
 * plural agreement for the term length ("1 year" / "2 years", «1 έτος» /
 * «2 έτη»), so it is built rather than looked up.
 */
export function durationSentence({ language, startDate, endDate, termYears, terminationNum }) {
  if (language === 'el') {
    const approx = termYears ? ` (περίπου ${termYears} ${termYears > 1 ? 'έτη' : 'έτος'})` : '';
    // On the short form there is no separate Termination clause to point at, so
    // the cross-reference is dropped rather than printing "Άρθρο null".
    const ref = terminationNum ? ` σύμφωνα με το Άρθρο ${terminationNum}` : '';
    return `Η Συμφωνία αρχίζει στις ${startDate} και ισχύει μέχρι τις ${endDate}${approx}, εκτός αν τερματιστεί νωρίτερα${ref}.`;
  }
  const approx = termYears ? ` (approximately ${termYears} year${termYears > 1 ? 's' : ''})` : '';
  const ref = terminationNum ? ` in accordance with Section ${terminationNum}` : '';
  return `This Agreement shall commence on ${startDate} and shall remain in force until ${endDate}${approx}, unless terminated earlier${ref}.`;
}

/**
 * Governing-law sentence. The law and jurisdiction themselves are free text on
 * the contract (e.g. "the Republic of Cyprus"), so only the frame translates.
 */
export function governingLawSentence({ language, governingLaw, jurisdiction }) {
  return language === 'el'
    ? `Η Συμφωνία διέπεται από τους νόμους ${governingLaw === 'the Republic of Cyprus' ? 'της Κυπριακής Δημοκρατίας' : governingLaw}, με αποκλειστική δικαιοδοσία ${jurisdiction === 'Nicosia, Cyprus' ? 'στη Λευκωσία, Κύπρος' : jurisdiction}.`
    : `This Agreement shall be governed by the laws of ${governingLaw}, with exclusive jurisdiction in ${jurisdiction}.`;
}

/**
 * Closing partnership note above the signature block.
 */
export function closingNote({ language, clientName }) {
  return language === 'el'
    ? `Η Science of Sports είναι περήφανη για τη συνεργασία της με ${clientName} και δεσμεύεται να παρέχει ανάλυση απόδοσης του υψηλότερου επαγγελματικού επιπέδου καθ' όλη τη διάρκεια της Συμφωνίας.`
    : `Science of Sports is proud to partner with ${clientName} and is committed to delivering performance analysis of the highest professional standard throughout this Agreement.`;
}

/**
 * Greek names for the clause a Special Term relates to. The stored value is the
 * ENGLISH clause name (SPECIAL_TERM_CLAUSES), which is what makes a term written
 * on an English draft still resolve after the document is switched to Greek.
 */
const EL_CLAUSE_NAMES = {
  'General': 'Γενικά',
  'Purpose': 'Αντικείμενο',
  'Scope of Services': 'Υπηρεσίες',
  'Scope of Analysis': 'Ανάλυση',
  'Fees & Payment': 'Χρεώσεις & Πληρωμή',
  'Commercial Terms & Club Commission': 'Εμπορικοί Όροι & Προμήθεια',
  'Sponsorship Rights': 'Δικαιώματα Χορηγίας',
  'Branding & Materials': 'Προβολή & Υλικό',
  'Confidentiality & Data Protection': 'Εμπιστευτικότητα & Προσωπικά Δεδομένα',
  'Intellectual Property Rights': 'Πνευματική Ιδιοκτησία',
  'Duration': 'Διάρκεια',
  'Termination': 'Λήξη & Καταγγελία',
  'Limitation of Liability': 'Ευθύνη',
  'Force Majeure': 'Ανωτέρα Βία',
  'Governing Law & Jurisdiction': 'Εφαρμοστέο Δίκαιο',
};
export function clauseName(name, language) {
  return language === 'el' ? (EL_CLAUSE_NAMES[name] || name) : name;
}

/**
 * The bank-transfer sentence. When the contract is billed in instalments, the
 * invoice clause is qualified mid-sentence ("...by the Service Provider FOR THE
 * APPLICABLE INSTALMENT, in accordance with..."), so this is built rather than
 * looked up — a flat string silently dropped that qualifier.
 */
export function bankTransferSentence({ language, perInstalment, latePaymentPenalty }) {
  const el = language === 'el';
  const penalty = (latePaymentPenalty == null || latePaymentPenalty === '')
    ? ''
    : (el
        ? ` Σε καθυστερημένα ποσά εφαρμόζεται προσαύξηση ${latePaymentPenalty}% τον μήνα.`
        : ` A late payment penalty of ${latePaymentPenalty}% per month applies to overdue amounts.`);
  if (el) {
    const qual = perInstalment ? ' για την αντίστοιχη δόση' : '';
    return `Οι πληρωμές γίνονται με τραπεζικό έμβασμα, μετά την έκδοση έγκυρου τιμολογίου από τον Πάροχο${qual} και σύμφωνα με την ισχύουσα νομοθεσία ΦΠΑ.${penalty}`;
  }
  const qual = perInstalment ? ' for the applicable instalment' : '';
  return `All payments shall be made by bank transfer following the issuance of a valid invoice by the Service Provider${qual}, in accordance with applicable VAT regulations.${penalty}`;
}

/**
 * The single combined "general terms" clause used by the SHORT FORM, in place
 * of the separate Confidentiality / IP / Liability / Force Majeure sections.
 * Each line is the irreducible core of the clause it replaces.
 */
export function shortGeneralTerms({ language, terminationNum }) {
  if (language === 'el') {
    return [
      // Data protection. The minors line is the one that must not be cut.
      'Τα δεδομένα και το υλικό του Πελάτη είναι εμπιστευτικά και χρησιμοποιούνται μόνο για τις υπηρεσίες της Συμφωνίας, σύμφωνα με τον GDPR. Όπου αφορούν ανηλίκους, ο Πελάτης εξασφαλίζει τις απαραίτητες συγκαταθέσεις γονέα ή κηδεμόνα.',
      // IP, reduced to ownership on each side.
      'Το υλικό που παράγεται για τον Πελάτη (βίντεο, αναφορές, κλιπ) προορίζεται για δική του χρήση. Η πλατφόρμα, το λογισμικό και οι μέθοδοι του Παρόχου παραμένουν δικά του.',
      // Term, termination and governing law in one line.
      `Κάθε Μέρος μπορεί να τερματίσει τη Συμφωνία με γραπτή ειδοποίηση τριών (3) μηνών. Η Συμφωνία διέπεται από το κυπριακό δίκαιο. Κάθε τροποποίηση γίνεται γραπτώς και υπογράφεται και από τα δύο Μέρη.`,
    ];
  }
  return [
    "The Client's data and materials are confidential and used only for the services under this Agreement, in accordance with the GDPR. Where they concern minors, the Client shall obtain any necessary parental or guardian consent.",
    "The materials produced for the Client (video, reports, clips) are for the Client's own use. The Service Provider's platform, software and methods remain its own.",
    "Either Party may terminate this Agreement with three (3) months' written notice. This Agreement is governed by Cyprus law. Any amendment must be made in writing and signed by both Parties.",
  ];
}

/** Greek descriptor for the client party clause, by entity type. */
export function elClientEntityDescriptor(entityType) {
  switch (entityType) {
    case 'club':       return 'σωματείο δεόντως εγγεγραμμένο κατά τους νόμους';
    case 'federation': return 'ομοσπονδία δεόντως εγγεγραμμένη κατά τους νόμους';
    case 'agency':     return 'εταιρεία δεόντως εγγεγραμμένη κατά τους νόμους';
    case 'sponsor':    return 'εταιρεία δεόντως εγγεγραμμένη κατά τους νόμους';
    default:           return 'εταιρεία δεόντως εγγεγραμμένη κατά τους νόμους';
  }
}

/* -------------------------------------------------------------------------
   SERVICE CATALOG — Greek labels, details and group names.

   Keyed by SERVICE_CATALOG key so a service missing here falls back to its
   English label rather than rendering blank. The services a 2nd Division club
   actually buys are translated in full; the sponsorship inventory keeps its
   English labels until a Greek sponsorship is actually drafted (a sponsorship
   is bespoke and negotiated in English today).
   ------------------------------------------------------------------------- */
export const EL_SERVICE_GROUPS = {
  'Core Services': 'Βασικές Υπηρεσίες',
  'Recording Services': 'Υπηρεσίες Καταγραφής',
  'Analysis Services': 'Υπηρεσίες Ανάλυσης',
  'Reporting Services': 'Αναφορές',
  'Coaching Support': 'Υποστήριξη Προπονητών',
};

export const EL_SERVICES = {
  platform_access: {
    label: 'Πρόσβαση στην Πλατφόρμα',
    detail: 'Βίντεο και δεδομένα μαζί, φάσεις και κλιπ αγώνων, συγκρίσεις παικτών, κατατάξεις ομάδων και παικτών — όλα σε ένα σημείο.',
  },
  agency_subscription: {
    label: 'Συνδρομή Πλατφόρμας για Πρακτορεία',
    detail: 'Πλήρης πρόσβαση στην πλατφόρμα για την παρακολούθηση και τεκμηρίωση των παικτών που εκπροσωπεί το πρακτορείο.',
  },
  camera_installation: {
    label: 'Εγκατάσταση Σταθερής Κάμερας',
    detail: 'Εφάπαξ εγκατάσταση σταθερής/ρομποτικής κάμερας στο γήπεδο του σωματείου.',
  },
  veo_camera: {
    label: 'Κάμερα VEO',
    detail: 'Παραχώρηση αυτόματης (ρομποτικής) κάμερας VEO για τη σεζόν, ώστε το σωματείο να καταγράφει τους αγώνες του.',
  },
  physical_data: {
    label: 'Δεδομένα Φυσικής Απόδοσης',
    detail: 'Φυσικά δεδομένα αγώνα, παρακολούθηση φόρτου παικτών και δείκτες απόδοσης.',
  },
  live_broadcasting: {
    label: 'Ζωντανή Μετάδοση Αγώνων',
    detail: 'Ζωντανή μετάδοση αγώνων για γονείς, προπονητές και τη διοίκηση του σωματείου.',
  },
  match_recording: {
    label: 'Καταγραφή Αγώνων (ρομποτική κάμερα)',
    detail: 'Καταγραφή εντός και εκτός έδρας αγώνων με σταθερή/ρομποτική κάμερα, σε επαγγελματική ποιότητα.',
  },
  own_team_analysis: {
    label: 'Τακτική Ανάλυση Ομάδας',
    detail: 'Ανάλυση δομής της ομάδας, φάσεων του παιχνιδιού και κρίσιμων στιγμών, με βίντεο κλιπ.',
  },
  opponent_analysis: {
    label: 'Τακτική Ανάλυση Αντιπάλου',
    detail: 'Στυλ παιχνιδιού, βασικοί παίκτες, δυνατά και αδύνατα σημεία του αντιπάλου πριν από κάθε αγώνα.',
  },
  match_reports: {
    label: 'Αναφορές Αγώνα (Ομάδα & Παίκτες)',
    detail: 'Κατοχή, πάσες, xG, δείκτες απόδοσης παικτών και οπτικοποιημένα δεδομένα.',
  },
  academy_reports: {
    label: 'Αναφορές Ακαδημίας',
    detail: 'Τριμηνιαίες και ετήσιες επισκοπήσεις απόδοσης της ακαδημίας — πρόοδος ομάδων και τακτική εικόνα.',
  },
  player_reports: {
    label: 'Ατομικές Αναφορές Παικτών',
    detail: 'Αναλυτική αξιολόγηση παίκτη, δυνατά σημεία και περιθώρια βελτίωσης, με υποστήριξη βίντεο.',
  },
  adhoc_reports: {
    label: 'Έκτακτες Αναφορές',
    detail: 'Αναφορές κατά παραγγελία για συγκεκριμένες ανάγκες και γρήγορη υποστήριξη αποφάσεων.',
  },
  coach_support: {
    label: 'Ατομική Υποστήριξη Προπονητή',
    detail: 'Καθοδήγηση στην πλατφόρμα, λύσεις βασισμένες στην ανάλυση και εκπαιδευτική υποστήριξη.',
  },
};

/** Greek label for a service, falling back to the English one. */
export function elServiceLabel(key, fallback) {
  return EL_SERVICES[key]?.label || fallback;
}
/** Greek detail line for a service, falling back to the English one. */
export function elServiceDetail(key, fallback) {
  return EL_SERVICES[key]?.detail || fallback;
}
/** Greek name for a service GROUP heading, falling back to the English one. */
export function elServiceGroup(group) {
  return EL_SERVICE_GROUPS[group] || group;
}
