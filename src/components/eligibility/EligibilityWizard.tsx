import React, { useState, useMemo } from 'react';
import { evaluateEligibility, type UserEligibilityProfile, type RecruitmentCriteria } from '../../engine/eligibility';
import { INDIA_JURISDICTIONS, jurisdictionName } from '../../data/india-jurisdictions';

interface RecruitmentData {
  id: string;
  title: string;
  slug: string;
  advtNumber: string;
  totalVacancies: number;
  postTitle: string;
  organisationName: string;
  organisationShortName?: string;
  organisationUrl?: string;
  criteria: RecruitmentCriteria;
}

interface Props {
  recruitments: RecruitmentData[];
}

export default function EligibilityWizard({ recruitments }: Props) {
  const [step, setStep] = useState<number>(1);

  // Pure empty starting states — no silent defaults
  const [dobInput, setDobInput] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('');
  const [selectedQualification, setSelectedQualification] = useState<UserEligibilityProfile['qualificationLevel'] | ''>('');
  const [degree, setDegree] = useState<string>('B.Tech');
  const [stream, setStream] = useState<string>('Computer Science');
  const [passingYear, setPassingYear] = useState<string>('2024');

  const [domicileStateCode, setDomicileStateCode] = useState<string>('');
  const [registrations, setRegistrations] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<UserEligibilityProfile['category'] | ''>('');

  const [experienceMonths, setExperienceMonths] = useState<string>('');
  const [percentage, setPercentage] = useState<string>('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [chestCm, setChestCm] = useState<string>('');
  const [skills, setSkills] = useState<string>('');
  const [hasTechCert, setHasTechCert] = useState<boolean>(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ELIGIBLE' | 'NEEDS_VERIFICATION' | 'NOT_ELIGIBLE'>('ELIGIBLE');

  // Construct user profile from candidate answers
  const profile: UserEligibilityProfile = useMemo(() => {
    return {
      dob: dobInput || undefined,
      gender: (selectedGender || 'MALE') as any,
      category: (selectedCategory || 'UR') as any,
      domicileStateCode: domicileStateCode || undefined,
      isMpDomicile: domicileStateCode ? domicileStateCode === 'MP' : undefined,
      registrations: registrations ? registrations.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      hasMpRojgarPanjiyan: registrations ? registrations.toUpperCase().split(',').map(value => value.trim()).includes('MP_ROJGAR') : undefined,
      hasCpct: hasTechCert,
      qualificationLevel: (selectedQualification || 'GRADUATION') as any,
      stream: stream || undefined,
      percentage: percentage ? Number(percentage) : undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      chestCm: chestCm ? Number(chestCm) : undefined,
      experienceMonths: experienceMonths ? Number(experienceMonths) : undefined,
      additionalSkills: skills.split(',').map(value => value.trim()).filter(Boolean),
    };
  }, [dobInput, selectedGender, selectedCategory, domicileStateCode, registrations, hasTechCert, selectedQualification, stream, percentage, heightCm, chestCm, experienceMonths, skills]);

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

  // Step Validation Guard
  const handleContinue = () => {
    setValidationError(null);

    if (step === 1) {
      const dob = new Date(dobInput);
      if (!dobInput || !Number.isFinite(dob.getTime()) || dob >= new Date()) {
        setValidationError('Please enter a valid date of birth.');
        return;
      }
      if (!selectedGender) {
        setValidationError('Please select your gender.');
        return;
      }
    } else if (step === 2) {
      if (!selectedQualification) {
        setValidationError('Please select your highest educational qualification level.');
        return;
      }
    } else if (step === 3) {
      if (!domicileStateCode) {
        setValidationError('Please select your domicile state or union territory.');
        return;
      }
    } else if (step === 4) {
      if (!selectedCategory) {
        setValidationError('Please select your social category for reservation and age relaxation.');
        return;
      }
    }

    setStep(s => Math.min(5, s + 1));
  };

  const handleFinishEvaluation = () => {
    setHasEvaluated(true);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {!hasEvaluated ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Top Bar with Clear Stepper & Progress Percentage */}
          <div className="bg-muted/50 border-b border-border p-6 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  Check what you can apply for
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Answer 5 questions. No account required · Zero ads · Evaluated against each authority's stored official rules.
                </p>
              </div>
              <div className="self-start sm:self-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono border border-primary/20">
                  Step {step} of 5 · {step * 20}% Complete
                </span>
              </div>
            </div>

            {/* 5-Step Visual Progress Rail */}
            <div className="grid grid-cols-5 gap-2 pt-2">
              {[
                { num: 1, label: 'Basic' },
                { num: 2, label: 'Education' },
                { num: 3, label: 'Domicile' },
                { num: 4, label: 'Category' },
                { num: 5, label: 'Review' },
              ].map(s => (
                <div key={s.num} className="flex flex-col gap-1.5">
                  <div
                    className={`h-2 rounded-full transition-all ${
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

          {/* Wizard Body Form */}
          <div className="p-6 sm:p-8">
            {/* Validation Error Banner */}
            {validationError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2.5 animate-shake">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span className="font-semibold">{validationError}</span>
              </div>
            )}

            {/* STEP 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <label className="text-base sm:text-lg font-bold text-foreground block mb-1">
                    What is your date of birth? <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-muted-foreground mb-3">
                    We calculate your exact age separately for each notification’s cutoff date.
                  </p>
                  <div className="max-w-xs">
                    <input
                      type="date"
                      value={dobInput}
                      onChange={e => {
                        setDobInput(e.target.value);
                        setValidationError(null);
                      }}
                      className="w-full text-xl font-bold font-mono px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-foreground"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-sm font-bold text-foreground block mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'MALE', label: 'Male (पुरुष)' },
                      { id: 'FEMALE', label: 'Female (महिला)' },
                      { id: 'OTHER', label: 'Other (अन्य)' },
                    ].map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedGender(g.id as any);
                          setValidationError(null);
                        }}
                        className={`p-3.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          selectedGender === g.id
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inline "Why We Ask" Box */}
                <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <div>
                    <strong className="text-foreground font-semibold">Why we ask:</strong> Official state gazette notifications calculate exact candidate age cutoffs on specific dates (typically 01 January) and mandate different physical standards and horizontal reservation quotas by gender.
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Education */}
            {step === 2 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
                    What is your highest qualification? <span className="text-red-500">*</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select the highest educational milestone you have completed.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { id: '10TH', label: '10th Pass (High School)' },
                      { id: '12TH', label: '12th Pass (Higher Secondary)' },
                      { id: 'ITI', label: 'ITI Certificate' },
                      { id: 'DIPLOMA', label: 'Polytechnic Diploma' },
                      { id: 'GRADUATION', label: 'Graduation (Bachelor Degree)' },
                      { id: 'POST_GRADUATION', label: 'Post Graduation (Master Degree)' },
                    ].map(q => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          setSelectedQualification(q.id as any);
                          setValidationError(null);
                        }}
                        className={`p-3.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                          selectedQualification === q.id
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{q.label}</span>
                          {selectedQualification === q.id && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedQualification === 'GRADUATION' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-muted/40 border border-border mb-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Degree Type</label>
                        <select
                          value={degree}
                          onChange={e => setDegree(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground outline-none"
                        >
                          <option value="B.Tech">B.Tech / B.E.</option>
                          <option value="B.Sc">B.Sc</option>
                          <option value="B.Com">B.Com</option>
                          <option value="B.A.">B.A.</option>
                          <option value="Other">Other Bachelor Degree</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Discipline / Stream</label>
                        <select
                          value={stream}
                          onChange={e => setStream(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground outline-none"
                        >
                          <option value="Computer Science">Computer Science / IT</option>
                          <option value="Mechanical">Mechanical Engineering</option>
                          <option value="Civil">Civil Engineering</option>
                          <option value="General">General / Humanities</option>
                          <option value="Commerce">Commerce / Accounts</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1">Passing Year</label>
                        <select
                          value={passingYear}
                          onChange={e => setPassingYear(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground outline-none"
                        >
                          <option value="2026">2026 (Final Year)</option>
                          <option value="2025">2025</option>
                          <option value="2024">2024</option>
                          <option value="2023">2023</option>
                          <option value="2022">2022 or earlier</option>
                        </select>
                      </div>
                    </div>
                  )}

                  <div className="max-w-xs mb-4">
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">Qualifying percentage (if known)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={percentage}
                      onChange={e => setPercentage(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg bg-card border border-border text-foreground outline-none"
                    />
                  </div>

                  {/* Inline "Why We Ask" Box */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div>
                      <strong className="text-foreground font-semibold">Why we ask:</strong> We evaluate educational ranks hierarchically: 8TH &lt; 10TH &lt; 12TH &lt; DIPLOMA &lt; GRADUATION &lt; POST_GRADUATION. Having a higher degree satisfies lower baseline requirements.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Domicile & employment registrations */}
            {step === 3 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
                    Domicile & Employment Registration <span className="text-red-500">*</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    State-specific reservations and registrations vary by notification. We compare your answers with each recruitment independently.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-2">
                        Your domicile state or union territory
                      </label>
                      <select value={domicileStateCode} onChange={event => { setDomicileStateCode(event.target.value); setValidationError(null); }} className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground">
                        <option value="">Select domicile</option>
                        {INDIA_JURISDICTIONS.filter(item => item.code !== 'IN').map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                      </select>
                    </div>

                    <div className="pt-2">
                      <label className="text-xs font-bold text-foreground block mb-2">
                        Employment registrations or certificates held (optional)
                      </label>
                      <input type="text" value={registrations} onChange={event => setRegistrations(event.target.value)} placeholder="e.g. MP_ROJGAR, UP_SEWAYOJAN (leave blank if none)" className="w-full rounded-xl border border-border bg-card p-3 text-sm text-foreground font-mono" />
                    </div>
                  </div>

                  {/* Inline "Why We Ask" Box */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div>
                      <strong className="text-foreground font-semibold">Why we ask:</strong> Each state and recruiting authority publishes its own domicile, reservation, and employment-registration rules. No MP rule is applied to another state unless that recruitment explicitly stores it.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Category & Reservation */}
            {step === 4 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
                    What is your reservation category? <span className="text-red-500">*</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Determines statutory upper age relaxations (up to +5 years) and qualifying marks.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    {[
                      { id: 'UR', label: 'General / Unreserved (UR)' },
                      { id: 'OBC', label: 'OBC (Non-Creamy Layer)' },
                      { id: 'SC', label: 'SC (Scheduled Caste)' },
                      { id: 'ST', label: 'ST (Scheduled Tribe)' },
                      { id: 'EWS', label: 'EWS (Economically Weaker)' },
                    ].map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c.id as any);
                          setValidationError(null);
                        }}
                        className={`p-3.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                          selectedCategory === c.id
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                            : 'border-border bg-card text-foreground hover:bg-muted'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  {/* Inline "Why We Ask" Box */}
                  <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    <div>
                      <strong className="text-foreground font-semibold">Statutory rule:</strong> Age relaxations are read from each recruitment record. The engine does not reuse one state's relaxation matrix for another state.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Specialized Criteria */}
            {step === 5 && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-foreground mb-1">
                    Specialized Requirements (Optional)
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    These optional criteria apply only to specialized uniforms or technical posts.
                  </p>

                  <div className="space-y-4 mb-6">
                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-foreground">
                          Height (cm, if measured)
                          <input type="number" min="100" max="250" value={heightCm} onChange={e => setHeightCm(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg bg-card border border-border" />
                        </label>
                        <label className="text-xs font-semibold text-foreground">
                          Chest (cm, if applicable)
                          <input type="number" min="50" max="200" value={chestCm} onChange={e => setChestCm(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg bg-card border border-border" />
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasTechCert}
                          onChange={e => setHasTechCert(e.target.checked)}
                          className="size-4 rounded text-primary focus:ring-primary mt-0.5"
                        />
                        <div>
                          <span className="text-xs font-semibold text-foreground block">
                            I hold a valid CPCT scorecard
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Select only for CPCT; enter other certificates separately below.
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="p-4 rounded-xl bg-card border border-border">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-foreground">
                          Experience (months)
                          <input type="number" min="0" value={experienceMonths} onChange={e => setExperienceMonths(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg bg-card border border-border" />
                        </label>
                        <label className="text-xs font-semibold text-foreground">
                          Other certificates (comma-separated)
                          <input type="text" value={skills} onChange={e => setSkills(e.target.value)} placeholder="Hindi Typing, ITI" className="mt-1 w-full p-2.5 rounded-lg bg-card border border-border" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Summary Profile Box */}
                  <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs text-muted-foreground">
                    <span className="font-bold text-foreground block mb-2 uppercase tracking-wider text-[10px]">
                      Profile ready for evaluation:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-foreground font-mono">
                      <div>DOB: <strong>{dobInput || 'Not provided'}</strong></div>
                      <div>Gender: <strong>{selectedGender}</strong></div>
                      <div>Category: <strong>{selectedCategory}</strong></div>
                      <div>Domicile: <strong>{jurisdictionName(domicileStateCode)}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Form Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-border mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setValidationError(null);
                    setStep(s => Math.max(1, s - 1));
                  }}
                  className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-colors"
                >
                  &larr; Back
                </button>
              ) : (
                <span />
              )}

              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-6 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 ml-auto"
                >
                  <span>Continue</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinishEvaluation}
                  className="px-6 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 ml-auto"
                >
                  <span>Calculate Eligible Matches</span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* RESULTS SCREEN: Transparent, explainable rule outcomes */
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                  Evaluation Report
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                  Your Statutory Opportunities Breakdown
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Evaluated across {recruitments.length} published recruitments using each authority's stored official criteria.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="/eligibility/report"
                  onClick={() => {
                    try {
                      const reportData = {
                        profile: {
                          dob: dobInput,
                          gender: selectedGender,
                          qualification: selectedQualification,
                          domicile: jurisdictionName(domicileStateCode),
                          category: selectedCategory,
                          registrations: registrations.split(',').map(value => value.trim()).filter(Boolean),
                          hasCpct: hasTechCert,
                          percentage: percentage ? Number(percentage) : undefined,
                          heightCm: heightCm ? Number(heightCm) : undefined,
                          chestCm: chestCm ? Number(chestCm) : undefined,
                          experienceMonths: experienceMonths ? Number(experienceMonths) : undefined,
                        },
                        timestamp: new Date().toISOString(),
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
                            url: r.recruitment.organisationUrl,
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
                        ineligibleCount: results.filter(r => r.overallStatus === 'NOT_ELIGIBLE').length,
                      };
                      sessionStorage.setItem('nirnay_eval_report', JSON.stringify(reportData));
                    } catch (e) {
                      console.error('Error storing eval report', e);
                    }
                  }}
                  className="px-4 py-2.5 rounded-lg bg-primary hover:bg-blue-700 text-primary-foreground text-xs sm:text-sm font-semibold shadow-sm transition-colors inline-flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Download Report</span>
                </a>
                <button
                  type="button"
                  onClick={() => setHasEvaluated(false)}
                  className="px-4 py-2.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs sm:text-sm font-medium transition-colors"
                >
                  Edit Answers
                </button>
              </div>
            </div>

            {/* Segmented Result Summary Tabs */}
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
                  <span className="text-xs font-semibold text-amber-800">Needs Verification</span>
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
                  <span className="text-xs font-semibold text-red-800">Not Eligible</span>
                  <span className="size-2 rounded-full bg-red-500"></span>
                </div>
                <span className="text-2xl font-bold font-mono text-red-700">{ineligibleCount}</span>
              </button>
            </div>
          </div>

          {/* Results Cards List */}
          <div className="space-y-4">
            {filteredResults.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">No recruitment opportunities under this category.</p>
              </div>
            ) : (
              filteredResults.map(r => (
                <div key={r.recruitment.id} className="bg-card rounded-2xl border border-border p-6 hover:border-border/80 transition-all shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {r.recruitment.organisationName || 'Government Authority'}
                      </span>
                      <h3 className="text-base sm:text-lg font-bold text-foreground">
                        {r.recruitment.title}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
                        r.overallStatus === 'ELIGIBLE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : r.overallStatus === 'NEEDS_VERIFICATION'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {r.overallStatus === 'ELIGIBLE' ? 'Eligible' : r.overallStatus === 'NEEDS_VERIFICATION' ? 'Verification Required' : 'Not Eligible'}
                    </span>
                  </div>

                  {/* Explainable Rule-by-Rule Breakdown */}
                  <div className="space-y-2 pt-2 pb-4 text-xs border-t border-border/60 mt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                      Rule Application Breakdown:
                    </span>
                    {r.items.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        {item.status === 'MATCH' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : item.status === 'UNKNOWN' ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        )}
                        <span className={item.status === 'MATCH' ? 'text-foreground' : item.status === 'UNKNOWN' ? 'text-amber-900 font-medium' : 'text-red-700 font-medium'}>
                          <strong className="font-semibold">{item.ruleName}:</strong> {item.message || item.requirement}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground font-mono">
                      Total Vacancies: {r.recruitment.totalVacancies?.toLocaleString() || 'Announced'}
                    </span>
                    <a
                      href={`/recruitments/${r.recruitment.slug}`}
                      className="font-semibold text-xs text-primary hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>View Official Gazette Details</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
