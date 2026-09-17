import React, { useState, useMemo } from 'react';
import { evaluateEligibility, type UserEligibilityProfile, type RecruitmentCriteria, type OverallEligibilityStatus } from '../../engine/eligibility';

interface RecruitmentData {
  id: string;
  title: string;
  slug: string;
  advtNumber: string;
  totalVacancies: number;
  postTitle: string;
  organisationName: string;
  criteria: RecruitmentCriteria;
}

interface Props {
  recruitments: RecruitmentData[];
}

export default function EligibilityWizard({ recruitments }: Props) {
  const [step, setStep] = useState<number>(1);
  const [profile, setProfile] = useState<UserEligibilityProfile>({
    dob: '',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: '12TH',
    heightCm: undefined,
  });

  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'ELIGIBLE' | 'NEEDS_VERIFICATION' | 'NOT_ELIGIBLE'>('ALL');

  // Vercel React Best Practice: Memoize heavy rule evaluations across all recruitments
  const results = useMemo(() => {
    return recruitments.map(rec => {
      const evalResult = evaluateEligibility(profile, rec.criteria);
      return {
        recruitment: rec,
        ...evalResult,
      };
    });
  }, [recruitments, profile]);

  const { eligibleCount, verificationCount, ineligibleCount } = useMemo(() => {
    let eligible = 0;
    let verification = 0;
    let ineligible = 0;

    for (const r of results) {
      if (r.overallStatus === 'ELIGIBLE') eligible++;
      else if (r.overallStatus === 'NEEDS_VERIFICATION') verification++;
      else if (r.overallStatus === 'NOT_ELIGIBLE') ineligible++;
    }

    return {
      eligibleCount: eligible,
      verificationCount: verification,
      ineligibleCount: ineligible,
    };
  }, [results]);

  const filteredResults = useMemo(() => {
    if (activeTab === 'ALL') return results;
    return results.filter(r => r.overallStatus === activeTab);
  }, [results, activeTab]);

  const updateField = <K extends keyof UserEligibilityProfile>(key: K, value: UserEligibilityProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-2 sm:px-0">
      {!hasEvaluated ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 no-print">
          {/* Header */}
          <div className="mb-8 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                नियम आधारित मूल्यांकन
              </span>
              <span className="text-xs text-slate-500 font-medium">Deterministic Rule Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
              Madhya Pradesh Govt Jobs Eligibility Calculator
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
              Step-by-step verification. Skipped fields are evaluated as <strong>Needs Verification</strong> and will not falsely disqualify you.
            </p>
          </div>

          {/* Stepper Progress Bar */}
          <div className="mb-8" aria-label="Progress">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span className={step >= 1 ? 'text-indigo-600 font-bold' : ''}>1. व्यक्तिगत विवरण (Personal)</span>
              <span className={step >= 2 ? 'text-indigo-600 font-bold' : ''}>2. शैक्षणिक योग्यता (Education)</span>
              <span className={step >= 3 ? 'text-indigo-600 font-bold' : ''}>3. शारीरिक मापदंड (Physical)</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              />
            </div>
          </div>

          {/* Form Step 1: Personal Profile */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="dob-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  जन्म तिथि (Date of Birth) <span className="text-rose-600">*</span>
                </label>
                <input
                  id="dob-input"
                  type="date"
                  value={profile.dob || ''}
                  onChange={e => updateField('dob', e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-slate-900 text-sm font-mono"
                  required
                />
                <p className="text-xs text-slate-500 mt-1.5">
                  Age is strictly measured as of the notification cutoff date (e.g. <strong>01-Jan-2026</strong> for 2026 drives).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="gender-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    लिंग (Gender)
                  </label>
                  <select
                    id="gender-select"
                    value={profile.gender || 'MALE'}
                    onChange={e => updateField('gender', e.target.value as any)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm bg-white"
                  >
                    <option value="MALE">पुरुष (Male)</option>
                    <option value="FEMALE">महिला (Female - Statutory Age Relaxation Applicable)</option>
                    <option value="OTHER">अन्य (Other)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="category-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    आरक्षण वर्ग (Category)
                  </label>
                  <select
                    id="category-select"
                    value={profile.category || 'UR'}
                    onChange={e => updateField('category', e.target.value as any)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm bg-white font-mono"
                  >
                    <option value="UR">अनारक्षित (General / UR)</option>
                    <option value="OBC">अन्य पिछड़ा वर्ग (OBC - +3 Years)</option>
                    <option value="SC">अनुसूचित जाति (SC - +5 Years)</option>
                    <option value="ST">अनुसूचित जनजाति (ST - +5 Years)</option>
                    <option value="EWS">आर्थिक कमजोर वर्ग (EWS)</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">मध्य प्रदेश मूल निवासी (MP Domicile)</span>
                  <span className="text-xs text-slate-500">Are you a permanent resident of Madhya Pradesh?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('isMpDomicile', true)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.isMpDomicile === true
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    हाँ (Yes)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('isMpDomicile', false)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.isMpDomicile === false
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    नहीं (No)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Step 2: Educational Credentials */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="edu-select" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  उच्चतम शैक्षणिक योग्यता (Highest Qualification) <span className="text-rose-600">*</span>
                </label>
                <select
                  id="edu-select"
                  value={profile.qualificationLevel || '12TH'}
                  onChange={e => updateField('qualificationLevel', e.target.value as any)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm bg-white"
                >
                  <option value="8TH">8वीं उत्तीर्ण (8th Pass)</option>
                  <option value="10TH">10वीं उत्तीर्ण / हाई स्कूल (10th Matric)</option>
                  <option value="12TH">12वीं उत्तीर्ण / हायर सेकेंडरी (12th Intermediate)</option>
                  <option value="DIPLOMA">पॉलिटेक्निक / डिप्लोमा (Diploma)</option>
                  <option value="GRADUATION">स्नातक / बैचलर डिग्री (Graduation - BA / BSc / BCom / BTech)</option>
                  <option value="POST_GRADUATION">स्नातकोत्तर / मास्टर डिग्री (Post Graduation - MA / MSc / MTech)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">मध्य प्रदेश रोज़गार पंजीयन (Rojgar Panjiyan)</span>
                  <span className="text-xs text-slate-500">Do you have active registration on mprojgar.gov.in?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('hasMpRojgarPanjiyan', true)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.hasMpRojgarPanjiyan === true
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    हाँ (Yes)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('hasMpRojgarPanjiyan', false)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.hasMpRojgarPanjiyan === false
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    नहीं (No)
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-sm text-slate-900 block">CPCT स्कोरकार्ड (Computer Proficiency)</span>
                  <span className="text-xs text-slate-500">Do you possess a valid CPCT scorecard with Hindi typing certification?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateField('hasCpct', true)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.hasCpct === true
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    हाँ (Yes)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField('hasCpct', false)}
                    className={`min-w-[70px] min-h-[44px] px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      profile.hasCpct === false
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    नहीं (No)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Step 3: Physical Standards (Optional) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
                <strong>वैकल्पिक चरण (Optional Step):</strong> शारीरिक मापदंड केवल पुलिस आरक्षक व वन रक्षक पदों हेतु लागू हैं। यदि आपको अपनी सही लंबाई ज्ञात नहीं है, तो आप इसे खाली छोड़ सकते हैं।
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="height-input" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    ऊंचाई सेंटीमीटर में (Height in cm)
                  </label>
                  {profile.heightCm !== undefined && (
                    <button
                      type="button"
                      onClick={() => updateField('heightCm', undefined)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Clear / Skip
                    </button>
                  )}
                </div>
                <input
                  id="height-input"
                  type="number"
                  placeholder="उदा. 168 (छोड़ने के लिए खाली रखें)"
                  value={profile.heightCm ?? ''}
                  onChange={e => updateField('heightCm', e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm font-mono"
                />
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between wizard-nav">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="min-h-[44px] px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors"
              >
                &larr; पिछला (Back)
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="min-h-[44px] px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                अगला (Next) &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setHasEvaluated(true)}
                className="min-h-[44px] px-8 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm transition-colors"
              >
                पात्रता परिणाम देखें (Evaluate Eligibility) &rarr;
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="space-y-6">
          {/* Executive Assessment Overview */}
          <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-slate-500 block mb-1">
                  पात्रता मूल्यांकन विवरण (Report Digest)
                </span>
                <h2 className="text-2xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
                  Your Madhya Pradesh Recruitment Assessment
                </h2>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto no-print">
                <button
                  type="button"
                  onClick={() => setHasEvaluated(false)}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
                >
                  संशोधन करें (Edit)
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  <span>PDF रिपोर्ट डाउनलोड करें</span>
                </button>
              </div>
            </div>

            {/* Scoreboard Tabs */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setActiveTab('ELIGIBLE')}
                className={`p-4 rounded-lg border text-center transition-all ${
                  activeTab === 'ELIGIBLE'
                    ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 block font-mono tabular-nums">
                  {eligibleCount}
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mt-1">
                  पात्र (Eligible)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NEEDS_VERIFICATION')}
                className={`p-4 rounded-lg border text-center transition-all ${
                  activeTab === 'NEEDS_VERIFICATION'
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 block font-mono tabular-nums">
                  {verificationCount}
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mt-1">
                  सत्यापन आवश्यक (Check)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NOT_ELIGIBLE')}
                className={`p-4 rounded-lg border text-center transition-all ${
                  activeTab === 'NOT_ELIGIBLE'
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80'
                }`}
              >
                <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 block font-mono tabular-nums">
                  {ineligibleCount}
                </span>
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mt-1">
                  अपात्र (Ineligible)
                </span>
              </button>
            </div>
          </div>

          {/* Detailed Match Digest */}
          <div className="space-y-4">
            {filteredResults.map(res => {
              const statusConfig: Record<OverallEligibilityStatus, { bg: string; badge: string; label: string }> = {
                ELIGIBLE: {
                  bg: 'border-emerald-200 bg-white',
                  badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                  label: 'आवेदन हेतु पूर्णतः पात्र (Eligible)',
                },
                NEEDS_VERIFICATION: {
                  bg: 'border-amber-200 bg-white',
                  badge: 'bg-amber-50 text-amber-800 border-amber-200',
                  label: 'सत्यापन अपेक्षित (Needs Verification)',
                },
                NOT_ELIGIBLE: {
                  bg: 'border-slate-200 bg-slate-50/50',
                  badge: 'bg-rose-50 text-rose-800 border-rose-200',
                  label: 'मानदंड अनुसार अपात्र (Not Eligible)',
                },
              };

              const config = statusConfig[res.overallStatus];

              return (
                <div
                  key={res.recruitment.id}
                  className={`rounded-xl p-5 sm:p-6 border ${config.bg} shadow-sm print-card transition-all`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider font-mono ${config.badge}`}>
                          {config.label}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          {res.recruitment.advtNumber}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans']">
                        {res.recruitment.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {res.recruitment.organisationName} &bull; <span className="font-mono tabular-nums">{res.recruitment.totalVacancies.toLocaleString()}</span> पद
                      </p>
                    </div>

                    <a
                      href={`/recruitments/${res.recruitment.slug}`}
                      className="no-print min-h-[38px] px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1 self-start sm:self-center"
                    >
                      <span>अधिसूचना विवरण</span> &rarr;
                    </a>
                  </div>

                  {/* Rule-by-rule Breakdown Table */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                    {res.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 py-1">
                        <span className="font-mono text-xs font-bold mt-0.5">
                          {item.status === 'MATCH' && '✅'}
                          {item.status === 'FAIL' && '❌'}
                          {item.status === 'UNKNOWN' && '⚠️'}
                        </span>
                        <div className="flex-1">
                          <span className="font-semibold text-slate-800">{item.ruleName}: </span>
                          <span className="text-slate-600">{item.message}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px] hidden sm:block whitespace-nowrap">
                          मानदंड: {item.requirement}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
