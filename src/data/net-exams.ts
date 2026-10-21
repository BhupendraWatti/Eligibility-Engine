// src/data/net-exams.ts
// Static reference data for the /net-exams page.
//
// Rules for editing this file:
//  - Every value must come from the exam body's own website or notice. A field that
//    has not been read from an official page stays `null`; the page then says
//    "See official notice" instead of guessing.
//  - `checkedOn` is the date a person last read the official page (ISO, IST).
//  - Never copy an exam into more than one category.

export type LinkItem = { label: string; url: string };

export type VerificationLevel = 'verified' | 'partial' | 'pending';

/** Dates and links for an exam that is currently being scheduled. All ISO dates are IST calendar days. */
export interface ListingInfo {
  applyStartIso: string;
  applyEndIso: string;
  lateFeeEndIso?: string;
  correctionStartIso?: string;
  correctionEndIso?: string;
  examStartIso: string;
  examEndIso: string;
  examDatesLabel: string;
  lateFeeLabel?: string;
  correctionLabel?: string;
  cityIntimation: string | null;
  admitCardDate: string | null;
  applyUrl: string;
  notificationPdfs: LinkItem[];
  /** null until the official site publishes it for this cycle */
  admitCardUrl: string | null;
  answerKeyUrl: string | null;
  resultUrl: string | null;
}

export interface EligibilityExam {
  id: string;
  listing?: ListingInfo;
  name: string;
  fullName: string;
  authority: string | null;
  purpose: string;
  eligibility: string[];
  subjects: string[] | null;
  subjectNote?: string;
  cycle: string | null;
  notification: string | null;
  applicationStart: string | null;
  applicationEnd: string | null;
  examDate: string | null;
  validity: string | null;
  links: LinkItem[];
  checkedOn: string | null;
  verification: VerificationLevel;
  notes?: string[];
}

export interface StateEligibilityExam extends EligibilityExam {
  state: string;
}

const CHECKED = '2026-10-21';

export const ugcNet: EligibilityExam = {
  id: 'ugc-net',
  name: 'UGC NET',
  fullName: 'University Grants Commission National Eligibility Test',
  authority: 'National Testing Agency (NTA), for the University Grants Commission',
  purpose:
    'National eligibility test for Assistant Professor, for Junior Research Fellowship (JRF) with Assistant Professor, and for PhD admission in eligible subjects.',
  eligibility: [
    'Master\'s degree with at least 55% marks (General, Unreserved, General-EWS) or at least 50% (OBC-NCL, SC, ST, PwD/PwBD, third gender), without rounding off.',
    'PhD holders whose Master\'s was completed by 19 September 1991 get a 5% relaxation (55% to 50%).',
    'Four-year bachelor\'s degree holders need at least 75% aggregate, with a 5% relaxation for certain categories.',
    'JRF age limit: not more than 30 years on 1 December 2026. The bulletin gives three kinds of qualification: JRF with Assistant Professor, Assistant Professor with PhD admission, and PhD admission only.',
    'The exam is a computer-based test.',
  ],
  subjects: ['Political Science', 'History', 'Geography', 'Commerce', 'Education'],
  subjectNote:
    'Examples from the 87 subjects in the bulletin\'s Annexure II. Read the Annexure for the complete list and subject codes.',
  cycle: 'December 2026',
  notification: 'Information bulletin as on 8 Oct 2026; updated bulletin as on 16 Oct 2026',
  applicationStart: '8 Oct 2026',
  applicationEnd: '28 Oct 2026, up to 11:50 PM (late-fee window 29 to 31 Oct 2026)',
  examDate: '14 to 18 Dec 2026 and 21 Dec 2026',
  validity: 'All India',
  listing: {
    applyStartIso: '2026-10-08',
    applyEndIso: '2026-10-28',
    lateFeeEndIso: '2026-10-31',
    correctionStartIso: '2026-11-02',
    correctionEndIso: '2026-11-04',
    examStartIso: '2026-12-14',
    examEndIso: '2026-12-21',
    examDatesLabel: '14 to 18 Dec 2026 and 21 Dec 2026',
    lateFeeLabel: '29 to 31 Oct 2026 (Rs 500 late fee)',
    correctionLabel: '2 to 4 Nov 2026',
    cityIntimation: '23 Nov 2026',
    admitCardDate: '7 Dec 2026',
    applyUrl:
      'https://examinationservices.nic.in/ExamSys27/root/home.aspx?enc=Ei4cajBkK1gZSfgr53ImFV/yIzhTZHBze3wooSg9DjjOvzupXmjixBOc0vZyJQ9v',
    notificationPdfs: [
      {
        label: 'Updated information bulletin (as on 16.10.2026)',
        url: 'https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/20261016860019603.pdf',
      },
      {
        label: 'Information bulletin (as on 08.10.2026)',
        url: 'https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610081852912625.pdf',
      },
      {
        label: 'Registration notice',
        url: 'https://cdnbbsr.s3waas.gov.in/s301eee509ee2f68dc6014898c309e86bf/uploads/2026/10/202610081928217016.pdf',
      },
    ],
    admitCardUrl: null,
    answerKeyUrl: null,
    resultUrl: null,
  },
  links: [
    { label: 'Official website (NTA)', url: 'https://ugcnet.nta.nic.in/' },
    { label: 'Information bulletin page', url: 'https://ugcnet.nta.nic.in/information-bulletin/' },
  ],
  checkedOn: CHECKED,
  verification: 'verified',
  notes: [
    'The 8 Oct 2026 registration notice gave the exam as 14 to 19 Dec 2026. The updated bulletin as on 16 Oct 2026 gives 14 to 18 Dec and 21 Dec 2026, and this page follows the updated bulletin. The bulletin says dates are tentative and exam timing is to be intimated later.',
    'Result, recorded responses and provisional answer keys are listed as "to be announced later" in the bulletin.',
  ],
};

export const csirNet: EligibilityExam = {
  id: 'csir-ugc-net',
  name: 'CSIR UGC NET',
  fullName: 'Joint CSIR-UGC National Eligibility Test',
  authority: 'National Testing Agency (NTA), on behalf of CSIR',
  purpose:
    'Eligibility for Junior Research Fellowship (JRF), Assistant Professor appointment and PhD admission in science subjects. The bulletin says Assistant Professor, not lectureship.',
  eligibility: [
    'Master\'s degree with at least 55% marks for General, Unreserved and EWS candidates; at least 50% for OBC-NCL, SC, ST, PwD/PwBD and Third Gender candidates.',
    'Final-year Master\'s students may apply provisionally.',
    'Four-year bachelor\'s degree holders need at least 75% aggregate; they can qualify for JRF and PhD admission but not for Assistant Professor.',
    'JRF age limit: not more than 30 years on 1 December 2026, with up to 5 years\' relaxation for listed categories. There is no upper age limit for Assistant Professor and PhD-only.',
    'Three categories of qualification: Category 1 (JRF, Assistant Professor, PhD), Category 2 (Assistant Professor, PhD) and Category 3 (PhD only).',
  ],
  subjects: [
    'Chemical Sciences',
    'Earth, Atmospheric, Ocean and Planetary Sciences',
    'Life Sciences and Biotechnology',
    'Mathematical Sciences',
    'Physical Sciences',
  ],
  cycle: 'December 2026',
  notification: '7 Oct 2026 (information bulletin)',
  applicationStart: '7 Oct 2026',
  applicationEnd: '5 Nov 2026 (regular fee); late-fee window 6 to 9 Nov 2026',
  examDate: '19, 22 and 27 Dec 2026',
  validity: 'All India',
  listing: {
    applyStartIso: '2026-10-07',
    applyEndIso: '2026-11-05',
    lateFeeEndIso: '2026-11-09',
    correctionStartIso: '2026-11-10',
    correctionEndIso: '2026-11-12',
    examStartIso: '2026-12-19',
    examEndIso: '2026-12-27',
    examDatesLabel: '19, 22 and 27 Dec 2026',
    lateFeeLabel: '6 to 9 Nov 2026 (Rs 500 late fee)',
    correctionLabel: '10 to 12 Nov 2026',
    cityIntimation: null,
    admitCardDate: null,
    applyUrl:
      'https://examinationservices.nic.in/ExamSys27/root/Home.aspx?enc=Ei4cajBkK1gZSfgr53ImFTqGsyg38PlGNCGSuvSzsiU0N2QIZeKq/cbFBgqeJZQh',
    notificationPdfs: [
      {
        label: 'Information bulletin',
        url: 'https://cdnbbsr.s3waas.gov.in/s3efdf562ce2fb0ad460fd8e9d33e57f57/uploads/2026/10/202610071407707951.pdf',
      },
      {
        label: 'Public notice: inviting online applications',
        url: 'https://cdnbbsr.s3waas.gov.in/s3efdf562ce2fb0ad460fd8e9d33e57f57/uploads/2026/10/20261007908428552.pdf',
      },
    ],
    admitCardUrl: null,
    answerKeyUrl: null,
    resultUrl: null,
  },
  links: [{ label: 'Official website (NTA)', url: 'https://csirnet.nta.nic.in/' }],
  checkedOn: CHECKED,
  verification: 'verified',
  notes: [
    'Correction window: 10 to 12 Nov 2026. The bulletin says all dates are tentative and may change.',
  ],
};

const SET_VALIDITY_NOTE =
  'A SET qualification is generally accepted only for Assistant Professor posts in the state (or region) of the conducting agency. Confirm the validity clause in the notice.';

export const setValidityNote = SET_VALIDITY_NOTE;

export const stateExams: StateEligibilityExam[] = [
  {
    id: 'andhra-pradesh',
    state: 'Andhra Pradesh',
    name: 'APSET',
    fullName: 'Andhra Pradesh State Eligibility Test',
    authority: 'Andhra University, Visakhapatnam, for the Government of Andhra Pradesh',
    purpose: 'Eligibility of Indian nationals for Assistant Professor posts in universities and colleges in Andhra Pradesh.',
    eligibility: ['Detailed eligibility is on the official eligibility page.'],
    subjects: null,
    subjectNote: 'The site states 30 subjects; the list is on the official subjects page.',
    cycle: 'APSET 2025 (held March 2026)',
    notification: '31 Dec 2025',
    applicationStart: '9 Jan 2026',
    applicationEnd: '5 Mar 2026 (with late fee; fee-only deadline 9 Feb 2026)',
    examDate: '28 and 29 Mar 2026',
    validity: 'Universities and colleges in Andhra Pradesh',
    links: [
      { label: 'Official website', url: 'https://www.apset.net.in/' },
      { label: 'Notifications', url: 'https://www.apset.net.in/notifications' },
      { label: 'Eligibility', url: 'https://www.apset.net.in/eligibility' },
      { label: 'Subjects', url: 'https://www.apset.net.in/subjects' },
    ],
    checkedOn: CHECKED,
    verification: 'verified',
    notes: ['Results were announced on 3 Jun 2026. A new cycle has not been shown on the site yet.'],
  },
  {
    id: 'assam-north-east',
    state: 'Assam and North-East',
    name: 'SLET (NE)',
    fullName: 'State Level Eligibility Test, Assam (North-East Region)',
    authority: 'SLET Commission, Assam (North-East Region), Gauhati University, Guwahati',
    purpose: 'Eligibility test for Assistant Professor posts, conducted for the North-East region.',
    eligibility: [
      'Master\'s degree from a UGC-recognised institution with at least 55% marks (General, Unreserved, EWS) or 50% (SC, ST, OBC non-creamy layer, PwD).',
      'No age limit. Final-year Master\'s students may apply.',
    ],
    subjects: null,
    subjectNote: 'The official site mentions Humanities and Social Science subjects; read the information brochure for the full list.',
    cycle: '2025-26 brochure',
    notification: 'Nov 2025',
    applicationStart: '21 Nov 2025',
    applicationEnd: '5 Jan 2026',
    examDate: '15 Mar 2026',
    validity: 'North-East region. The brochure lists the states covered.',
    links: [
      { label: 'Official website', url: 'https://sletne.org/' },
      { label: 'Online application', url: 'https://www.sletneonline.co.in/' },
      { label: 'Information brochure 2025-26 (PDF)', url: 'https://sletne.org/pdf/Information_Brochure_of_2025-2026.pdf' },
    ],
    checkedOn: CHECKED,
    verification: 'partial',
    notes: [
      'The official site did not show the dates, so the dates above come from a secondary report of the notice. Check them in the official brochure.',
    ],
  },
  {
    id: 'karnataka',
    state: 'Karnataka',
    name: 'K-SET',
    fullName: 'Karnataka State Eligibility Test',
    authority: 'K-SET Center for Lectureship, University of Mysore',
    purpose: 'State eligibility test for Assistant Professor posts in Karnataka.',
    eligibility: [],
    subjects: null,
    cycle: null,
    notification: null,
    applicationStart: null,
    applicationEnd: null,
    examDate: null,
    validity: null,
    links: [{ label: 'Official website', url: 'https://kset.uni-mysore.ac.in/' }],
    checkedOn: CHECKED,
    verification: 'partial',
    notes: ['The page we could read showed an old (2013) notice, so the current cycle is not confirmed. Check the official site.'],
  },
  {
    id: 'maharashtra',
    state: 'Maharashtra',
    name: 'MH-SET',
    fullName: 'Maharashtra State Eligibility Test',
    authority: 'Savitribai Phule Pune University',
    purpose: 'State eligibility test, accredited by the UGC, for Assistant Professor posts.',
    eligibility: ['Detailed criteria are on the official eligibility page.'],
    subjects: null,
    subjectNote: 'See the official Faculties and Subjects page.',
    cycle: '41st SET (2026)',
    notification: null,
    applicationStart: null,
    applicationEnd: null,
    examDate: '25 Oct 2026 per the admit card notice (the prospectus is dated 26 Jul 2026)',
    validity: 'Assistant Professor posts only (not JRF), in universities and colleges of Maharashtra',
    links: [
      { label: 'Official website', url: 'https://setexam.unipune.ac.in/' },
      { label: 'Eligibility criteria', url: 'https://setexam.unipune.ac.in/Eligibility_Criteria.aspx' },
      { label: 'Faculties and subjects', url: 'https://setexam.unipune.ac.in/Faculty_Subject.aspx' },
      { label: 'Important dates', url: 'https://setexam.unipune.ac.in/Important_Dates.aspx' },
      { label: 'Prospectus (PDF)', url: 'https://setexam.unipune.ac.in/SET_2026/Prospectus_SET_JULY_2026.pdf' },
    ],
    checkedOn: CHECKED,
    verification: 'partial',
    notes: ['The official page shows two exam dates (25 Oct 2026 and 26 Jul 2026) without explaining the difference. Confirm in the official PDFs.'],
  },
  {
    id: 'telangana',
    state: 'Telangana',
    name: 'TG SET',
    fullName: 'Telangana State Eligibility Test',
    authority: 'Osmania University, Hyderabad',
    purpose: 'State eligibility test for Assistant Professor posts in Telangana.',
    eligibility: ['See the Eligibility and Fee page on the official site.'],
    subjects: null,
    subjectNote: 'See the official syllabus page.',
    cycle: 'TG SET 2026',
    notification: null,
    applicationStart: null,
    applicationEnd: 'Last date without late fee was extended to 5 Sep 2026',
    examDate: null,
    validity: null,
    links: [
      { label: 'Official website', url: 'https://telanganaset.org/' },
      { label: 'Notification', url: 'https://telanganaset.org/notification.html' },
      { label: 'Important dates', url: 'https://telanganaset.org/imp-dates.html' },
      { label: 'Eligibility and fee', url: 'https://telanganaset.org/eligibility.html' },
      { label: 'Information brochure (PDF)', url: 'https://telanganaset.org/InformationBrochure2026.pdf' },
    ],
    checkedOn: CHECKED,
    verification: 'partial',
    notes: ['The home page shows a provisional answer key and an objection window, so the 2026 exam appears to be over.'],
  },
  ...[
    ['gujarat', 'Gujarat', 'GSET', 'Gujarat State Eligibility Test'],
    ['kerala', 'Kerala', 'Kerala SET', 'Kerala State Eligibility Test'],
    ['tamil-nadu', 'Tamil Nadu', 'TN SET', 'Tamil Nadu State Eligibility Test'],
    ['west-bengal', 'West Bengal', 'WBSET', 'West Bengal State Eligibility Test'],
    ['rajasthan', 'Rajasthan', 'RSET', 'Rajasthan State Eligibility Test'],
    ['madhya-pradesh', 'Madhya Pradesh', 'MP SET', 'Madhya Pradesh State Eligibility Test'],
  ].map(
    ([id, state, name, fullName]): StateEligibilityExam => ({
      id,
      state,
      name,
      fullName,
      authority: null,
      purpose: 'State eligibility test for Assistant Professor posts.',
      eligibility: [],
      subjects: null,
      cycle: null,
      notification: null,
      applicationStart: null,
      applicationEnd: null,
      examDate: null,
      validity: null,
      links: [],
      checkedOn: null,
      verification: 'pending',
      notes: ['Not yet checked against the official notice. Details and official links will be added once they are verified.'],
    }),
  ),
];

export const otherExams: EligibilityExam[] = [
  {
    id: 'icar-net',
    name: 'ICAR NET',
    fullName: 'National Eligibility Test in agricultural sciences (ICAR)',
    authority: 'Agricultural Scientists Recruitment Board (ASRB)',
    purpose: 'National eligibility test for teaching and research positions in agricultural universities and institutions.',
    eligibility: [],
    subjects: null,
    cycle: null,
    notification: null,
    applicationStart: null,
    applicationEnd: null,
    examDate: null,
    validity: null,
    links: [{ label: 'ASRB website', url: 'https://www.asrb.org.in/' }],
    checkedOn: CHECKED,
    verification: 'pending',
    notes: [
      'The ASRB site says its address is changing to asrb.gov.in, which did not load when we checked. The ICAR NET cycle details have not been read from the official notice yet.',
    ],
  },
];

export const otherExamsScopeNote =
  'Only distinct, officially recognised eligibility tests are listed here. UGC NET, CSIR UGC NET and the state SET/SLET tests are not repeated. School-teacher tests such as CTET and state TETs are outside this section.';
