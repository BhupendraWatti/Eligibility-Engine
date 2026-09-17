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
  const [age, setAge] = useState<number>(21);
  const [profile, setProfile] = useState<UserEligibilityProfile>({
    dob: '2005-01-01',
    gender: 'MALE',
    category: 'UR',
    isMpDomicile: true,
    hasMpRojgarPanjiyan: true,
    hasCpct: false,
    qualificationLevel: 'GRADUATION',
    heightCm: undefined,
  });

  const [degree, setDegree] = useState<string>('B.Tech');
  const [stream, setStream] = useState<string>('Computer Science');
  const [passingYear, setPassingYear] = useState<string>('2023');
  const [experience, setExperience] = useState<string>('none');
  const [meetsPhysical, setMeetsPhysical] = useState<boolean>(false);
  const [hasTechCert, setHasTechCert] = useState<boolean>(false);

  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ELIGIBLE' | 'NEEDS_VERIFICATION' | 'NOT_ELIGIBLE'>('ELIGIBLE');

  // Compute DOB from entered age
  const handleAgeChange = (val: number) => {
    setAge(val);
    const targetYear = new Date().getFullYear() - val;
    setProfile(prev => ({ ...prev, dob: `${targetYear}-01-01` }));
  };

  const updateField = <K extends keyof UserEligibilityProfile>(key: K, value: UserEligibilityProfile[K]) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  // Evaluate candidate results across all recruitments
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
    return results.filter(r => r.overallStatus === activeTab);
  }, [results, activeTab]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {!hasEvaluated ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Wizard Top Bar */}
          <div className="bg-muted/50 border-b border-border p-6 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Check what you can apply for
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Answer a few questions. No account required.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold self-start sm:self-auto">
                Step {step} of 5
              </span>
            </div>

            {/* 5-Step Progress Rail */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {[
                { num: 1, label: 'Basic' },
                { num: 2, label: 'Education' },
                { num: 3, label: 'Location' },
                { num: 4, label: 'Category' },
                { num: 5, label: 'Other' },
              ].map(s => (
                <div key={s.num} className="flex flex-col gap-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      s.num <= step ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-xs font-medium truncate ${
                      s.num === step
                        ? 'text-primary font-bold'
                        : s.num < step
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {s.num}. {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Wizard Body: Two-Column Form & Why-We-Ask Rail */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-6 sm:p-8">
            {/* Left Form Area (2 Cols) */}
            <div className="lg:col-span-2">
              {/* STEP 1: Basic Information */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      How old are you?
                    </h2>
                    <p className="text-xs text-muted-foreground mb-3">
                      Use your age on the closing date of a recruitment.
                    </p>
                    <div className="max-w-xs">
                      <input
                        type="number"
                        min="16"
                        max="65"
                        value={age}
                        onChange={e => handleAgeChange(parseInt(e.target.value) || 18)}
                        className="w-full text-xl font-bold font-mono px-4 py-3 rounded-xl bg-background border border-border focus:border-primary outline-none text-foreground"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <label className="text-sm font-bold text-foreground block mb-2">
                      Gender
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'] as const).map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => updateField('gender', g === 'PREFER_NOT_TO_SAY' ? 'MALE' : g)}
                          className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                            profile.gender === g || (g === 'PREFER_NOT_TO_SAY' && false)
                              ? 'border-primary bg-primary/10 text-primary shadow-2xs'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          {g === 'MALE' ? 'Male' : g === 'FEMALE' ? 'Female' : g === 'OTHER' ? 'Other' : 'Prefer not to say'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground pt-2">
                    Your answers stay in this session unless you choose to download a report.
                  </p>
                </div>
              )}

              {/* STEP 2: Education */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      What is your highest qualification?
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                      We compare this against the minimum qualification in each official notification.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                      {[
                        { id: '10TH', label: '10th Pass' },
                        { id: '12TH', label: '12th Pass' },
                        { id: 'ITI', label: 'ITI Certificate' },
                        { id: 'DIPLOMA', label: 'Polytechnic Diploma' },
                        { id: 'GRADUATION', label: 'Graduation' },
                        { id: 'POST_GRADUATION', label: 'Post Graduation' },
                      ].map(q => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => updateField('qualificationLevel', q.id as any)}
                          className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                            profile.qualificationLevel === q.id
                              ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{q.label}</span>
                            {profile.qualificationLevel === q.id && (
                              <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>

                    {profile.qualificationLevel === 'GRADUATION' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/40 border border-border mb-4">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Degree</label>
                          <select
                            value={degree}
                            onChange={e => setDegree(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground"
                          >
                            <option value="B.Tech">B.Tech / B.E.</option>
                            <option value="B.Sc">B.Sc</option>
                            <option value="B.Com">B.Com</option>
                            <option value="B.A.">B.A.</option>
                            <option value="Other">Other Degree</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Stream</label>
                          <select
                            value={stream}
                            onChange={e => setStream(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground"
                          >
                            <option value="Computer Science">Computer Science / IT</option>
                            <option value="Mechanical">Mechanical Engineering</option>
                            <option value="Civil">Civil Engineering</option>
                            <option value="General">General / Humanities</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Passing Year</label>
                          <select
                            value={passingYear}
                            onChange={e => setPassingYear(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground"
                          >
                            <option value="2026">2026 (Appearing)</option>
                            <option value="2025">2025</option>
                            <option value="2024">2024</option>
                            <option value="2023">2023</option>
                            <option value="2022">2022 or earlier</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-blue-50/80 border border-blue-100 text-xs text-blue-800 flex items-start gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-blue-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span>Some notifications accept equivalent qualifications. We will mark those for verification.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Location (Domicile) */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      Are you a domicile of Madhya Pradesh?
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                      State quota and age relaxations are statutory benefits for MP residents.
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <button
                        type="button"
                        onClick={() => updateField('isMpDomicile', true)}
                        className={`p-4 rounded-xl border text-sm font-semibold text-center transition-all ${
                          profile.isMpDomicile
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        Yes, MP Domicile (मूल निवासी)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateField('isMpDomicile', false)}
                        className={`p-4 rounded-xl border text-sm font-semibold text-center transition-all ${
                          !profile.isMpDomicile
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        No, Other State (अन्य राज्य)
                      </button>
                    </div>

                    <div className="p-4 rounded-xl bg-muted/40 border border-border">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={profile.hasMpRojgarPanjiyan}
                          onChange={e => updateField('hasMpRojgarPanjiyan', e.target.checked)}
                          className="size-4 rounded text-primary focus:ring-primary"
                        />
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            Active MP Employment Portal Registration (रोजगार पंजीयन)
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Mandatory for all MPESB application submissions.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Category & Reservation */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      What is your reservation category?
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                      Determines upper age relaxations (up to +5 years) and qualifying marks.
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'UR', label: 'General / UR' },
                        { id: 'OBC', label: 'OBC (Non-Creamy)' },
                        { id: 'SC', label: 'SC (Scheduled Caste)' },
                        { id: 'ST', label: 'ST (Scheduled Tribe)' },
                        { id: 'EWS', label: 'EWS (Economically Weaker)' },
                      ].map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => updateField('category', c.id as any)}
                          className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                            profile.category === c.id
                              ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Other Criteria */}
              {step === 5 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-foreground mb-1">
                      Anything else we should know?
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                      These details only affect some specialized recruitments.
                    </p>

                    <div className="space-y-4">
                      {/* Experience */}
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <label className="text-xs font-bold text-foreground block mb-2">Relevant Work Experience</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['none', '1-2 years', '3+ years'].map(exp => (
                            <button
                              key={exp}
                              type="button"
                              onClick={() => setExperience(exp)}
                              className={`p-2 rounded-lg text-xs font-medium border text-center transition-all ${
                                experience === exp
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border bg-muted/40 text-foreground'
                              }`}
                            >
                              {exp === 'none' ? 'No experience' : exp}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Physical Standards Check */}
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={meetsPhysical}
                            onChange={e => setMeetsPhysical(e.target.checked)}
                            className="size-4 rounded text-primary focus:ring-primary mt-0.5"
                          />
                          <div>
                            <span className="text-xs font-semibold text-foreground block">
                              I can meet role-specific physical standards
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              E.g. Male height 168 cm, Female height 155 cm for Police / Forest Guard posts.
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Technical Certs */}
                      <div className="p-4 rounded-xl bg-card border border-border">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={hasTechCert}
                            onChange={e => {
                              setHasTechCert(e.target.checked);
                              updateField('hasCpct', e.target.checked);
                            }}
                            className="size-4 rounded text-primary focus:ring-primary mt-0.5"
                          />
                          <div>
                            <span className="text-xs font-semibold text-foreground block">
                              I have a relevant technical certificate (CPCT / ITI / Typing)
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              Required for Patwari, Assistant Grade III, and Stenographer roles.
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 mt-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span>
                        Skipping a field means we cannot verify that requirement. It does not automatically make you ineligible.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                  className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </button>

                <div className="flex items-center gap-3">
                  {step === 5 ? (
                    <button
                      type="button"
                      onClick={() => setHasEvaluated(true)}
                      className="px-6 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                    >
                      <span>See my matches</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStep(s => Math.min(5, s + 1))}
                      className="px-5 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <span>Continue</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right Rail: "Why We Ask" & Profile Summary (1 Col) */}
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-muted/50 border border-border">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-2">
                  Why we ask
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Age and gender are used only where the official government notification makes them relevant for quotas, physical tests, or age cutoffs.
                </p>
                <div className="pt-3 mt-3 border-t border-border">
                  <a
                    href="/#closing-soon"
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Skip for now &rarr;
                  </a>
                </div>
              </div>

              {/* Profile summary card */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">
                  Entered Profile
                </h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Age:</span>
                    <span className="font-bold text-foreground">{age} yrs</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gender:</span>
                    <span className="font-medium text-foreground">{profile.gender}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Qualification:</span>
                    <span className="font-medium text-foreground">{profile.qualificationLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Domicile:</span>
                    <span className="font-medium text-foreground">{profile.isMpDomicile ? 'Madhya Pradesh' : 'Other'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Category:</span>
                    <span className="font-medium text-foreground">{profile.category}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* RESULTS SCREEN (Flowstep Screen 7) */
        <div className="space-y-6">
          {/* Results Hero Card */}
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  Eligibility check complete
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  We found {eligibleCount} opportunities that match your information.
                </p>
                <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-muted border border-border text-xs font-medium text-foreground">
                  <span>Age {age}</span>
                  <span>·</span>
                  <span>{profile.qualificationLevel}</span>
                  <span>·</span>
                  <span>{profile.isMpDomicile ? 'Madhya Pradesh' : 'All-India'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="/eligibility/report"
                  onClick={() => {
                    try {
                      const reportData = {
                        evaluatedAt: new Date().toISOString(),
                        reportId: `NIR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
                        profile: {
                          ...profile,
                          age,
                          degree,
                          stream,
                          passingYear,
                          meetsPhysical,
                          hasTechCert,
                        },
                        counts: {
                          eligible: eligibleCount,
                          verification: verificationCount,
                          ineligible: ineligibleCount,
                        },
                        eligibleOpportunities: results
                          .filter(r => r.overallStatus === 'ELIGIBLE')
                          .map(r => ({
                            id: r.recruitment.id,
                            title: r.recruitment.title,
                            slug: r.recruitment.slug,
                            org: r.recruitment.organisationName,
                            vacancies: r.recruitment.totalVacancies,
                            minAge: r.recruitment.criteria?.minAge,
                            maxAge: r.recruitment.criteria?.maxAgeGeneral,
                            url: r.recruitment.organisationUrl || 'https://esb.mp.gov.in',
                          })),
                        verificationOpportunities: results
                          .filter(r => r.overallStatus === 'NEEDS_VERIFICATION')
                          .map(r => ({
                            id: r.recruitment.id,
                            title: r.recruitment.title,
                            slug: r.recruitment.slug,
                            org: r.recruitment.organisationName,
                            reason: r.items.find(i => i.status === 'UNKNOWN')?.message || 'Candidate must self-verify physical or council criteria.',
                          })),
                      };
                      sessionStorage.setItem('nirnay_eval_report', JSON.stringify(reportData));
                    } catch (e) {
                      console.error('Error storing eval report', e);
                    }
                  }}
                  className="px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors inline-flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Download report</span>
                </a>
                <button
                  type="button"
                  onClick={() => setHasEvaluated(false)}
                  className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-colors"
                >
                  Edit answers
                </button>
              </div>
            </div>

            {/* Segmented Result Summary Cards */}
            <div className="grid grid-cols-3 gap-3 pt-6">
              <button
                type="button"
                onClick={() => setActiveTab('ELIGIBLE')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeTab === 'ELIGIBLE'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-emerald-800">Eligible</span>
                  <span className="size-2 rounded-full bg-emerald-600"></span>
                </div>
                <span className="text-2xl font-bold font-mono text-emerald-700">{eligibleCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NEEDS_VERIFICATION')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeTab === 'NEEDS_VERIFICATION'
                    ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-500'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-amber-800">Needs verification</span>
                  <span className="size-2 rounded-full bg-amber-600"></span>
                </div>
                <span className="text-2xl font-bold font-mono text-amber-700">{verificationCount}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('NOT_ELIGIBLE')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  activeTab === 'NOT_ELIGIBLE'
                    ? 'border-red-400 bg-red-50/50 ring-1 ring-red-400'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-red-800">Not eligible</span>
                  <span className="size-2 rounded-full bg-red-500"></span>
                </div>
                <span className="text-2xl font-bold font-mono text-red-700">{ineligibleCount}</span>
              </button>
            </div>
          </div>

          {/* Matching Recruitment Cards List */}
          <div className="space-y-4">
            {filteredResults.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-sm text-muted-foreground">No opportunities under this category.</p>
              </div>
            ) : (
              filteredResults.map(r => (
                <div key={r.recruitment.id} className="bg-card rounded-xl border border-border p-5 hover:border-border/80 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                        {r.recruitment.organisationName || 'MPESB'}
                      </span>
                      <h3 className="text-base font-bold text-foreground">
                        {r.recruitment.title}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
                        r.overallStatus === 'ELIGIBLE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.overallStatus === 'NEEDS_VERIFICATION'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {r.overallStatus === 'ELIGIBLE' ? 'Eligible' : r.overallStatus === 'NEEDS_VERIFICATION' ? 'Needs verification' : 'Not eligible'}
                    </span>
                  </div>

                  {/* Checklist rows */}
                  <div className="space-y-1.5 pt-2 pb-4 text-xs">
                    {r.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        {item.status === 'MATCH' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : item.status === 'UNKNOWN' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        )}
                        <span className={item.status === 'MATCH' ? 'text-foreground' : item.status === 'UNKNOWN' ? 'text-amber-800' : 'text-red-700'}>
                          <strong className="font-semibold">{item.ruleName}:</strong> {item.message || item.requirement}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-mono">
                      Vacancies: {r.recruitment.totalVacancies?.toLocaleString()}
                    </span>
                    <a
                      href={`/recruitments/${r.recruitment.slug}`}
                      className="font-semibold text-xs text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <span>View details & official link</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Neutral Disclaiming Note */}
          <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground text-center">
            This is a deterministic match against the information entered, not a selection guarantee. Verify every requirement in the official recruitment notification.
          </div>
        </div>
      )}
    </div>
  );
}
