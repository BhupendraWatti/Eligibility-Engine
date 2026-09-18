/**
 * NIRNAY — Canonical Recruitment Lifecycle & Metrics Domain Service
 * 
 * Single Source of Truth for recruitment publication states, factual lifecycle
 * state resolution, presentation mapping, and sector/platform metrics calculations.
 */

export type PublicationStatus = 'DRAFT' | 'PENDING_VERIFICATION' | 'PUBLISHED' | 'ARCHIVED';

export type ExamStatus = 'NOT_SCHEDULED' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED' | 'COMPLETED';

export type ResultStatus = 'NOT_DECLARED' | 'DECLARED';

export type CanonicalLifecycle =
  | 'NOT_STARTED'
  | 'APPLICATION_OPEN'
  | 'APPLICATION_CLOSING'
  | 'APPLICATION_CLOSED'
  | 'EXAM_SCHEDULED'
  | 'EXAM_COMPLETED'
  | 'RESULT_DECLARED';

export interface StatusPresentation {
  canonicalState: CanonicalLifecycle;
  label: string;
  badgeClass: string;
  isLiveApplication: boolean;
  description: string;
}

export interface RecruitmentMetrics {
  totalAnnouncedVacancies: number;
  activeDriveCount: number;
  activeVacancyCount: number;
  upcomingDriveCount: number;
  upcomingVacancyCount: number;
  examScheduledDriveCount: number;
  examScheduledVacancyCount: number;
  resultDeclaredDriveCount: number;
  resultDeclaredVacancyCount: number;
  currentRecruitmentCount: number;
  currentVacancyCount: number;
}

export interface MinimalRecruitmentInput {
  status?: string | null;
  lifecycleStatus?: string | null;
  applicationStart?: string | null;
  applicationEnd?: string | null;
  examDate?: string | null;
  examStatus?: string | null;
  resultStatus?: string | null;
  totalVacancies?: number | null;
}

/** Default closing soon threshold: 7 days before application closing date */
export const CLOSING_SOON_THRESHOLD_DAYS = 7;

/**
 * Normalizes input date to YYYY-MM-DD string in UTC/IST boundary
 */
export function normalizeDateString(d: Date | string | undefined | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  }
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

/**
 * Resolves the canonical lifecycle state based on authoritative factual fields and dates.
 * 
 * Hierarchy:
 * 1. Explicit Result Declaration -> RESULT_DECLARED
 * 2. Explicit Exam Completion -> EXAM_COMPLETED
 * 3. Explicit Exam Cancellation / Postponement / Active Exam Schedule -> EXAM_SCHEDULED
 * 4. Application End passed -> APPLICATION_CLOSED (or EXAM_SCHEDULED if examDate is present)
 * 5. Application End <= 7 days -> APPLICATION_CLOSING
 * 6. Application Start <= currentDate -> APPLICATION_OPEN
 * 7. Prior to Application Start -> NOT_STARTED
 */
export function resolveRecruitmentLifecycle(
  rec: MinimalRecruitmentInput,
  referenceDateInput?: Date | string
): CanonicalLifecycle {
  const refDateStr = normalizeDateString(referenceDateInput) || new Date().toISOString().split('T')[0];

  // 1. Authoritative Result Status override or legacy RESULT_DECLARED / FINAL_RESULT
  if (
    rec.resultStatus === 'DECLARED' ||
    rec.lifecycleStatus === 'RESULT_DECLARED' ||
    rec.lifecycleStatus === 'FINAL_RESULT' ||
    rec.lifecycleStatus === 'RESULT_OUT'
  ) {
    return 'RESULT_DECLARED';
  }

  // 2. Authoritative Exam Status override
  if (rec.examStatus === 'COMPLETED' || rec.lifecycleStatus === 'EXAM_COMPLETED' || rec.lifecycleStatus === 'EXAM_HELD') {
    return 'EXAM_COMPLETED';
  }

  const appStartStr = normalizeDateString(rec.applicationStart);
  const appEndStr = normalizeDateString(rec.applicationEnd);
  const examDateStr = normalizeDateString(rec.examDate);

  // 3. Application Date Window Resolution
  if (appStartStr && appEndStr) {
    // Before applications start
    if (refDateStr < appStartStr) {
      return 'NOT_STARTED';
    }

    // Within application window
    if (refDateStr <= appEndStr) {
      // Check 7-day closing window
      const endTimestamp = new Date(`${appEndStr}T23:59:59Z`).getTime();
      const refTimestamp = new Date(`${refDateStr}T00:00:00Z`).getTime();
      const diffDays = Math.ceil((endTimestamp - refTimestamp) / (1000 * 60 * 60 * 24));

      if (diffDays <= CLOSING_SOON_THRESHOLD_DAYS) {
        return 'APPLICATION_CLOSING';
      }
      return 'APPLICATION_OPEN';
    }

    // Past application closing date
    // If exam is scheduled/announced on or in future, or has examDate
    if (
      rec.examStatus === 'SCHEDULED' ||
      rec.lifecycleStatus === 'EXAM_SCHEDULED' ||
      rec.lifecycleStatus === 'ADMIT_CARD_OUT' ||
      rec.lifecycleStatus === 'ADMIT_CARD_RELEASED' ||
      (examDateStr && rec.examStatus !== 'CANCELLED')
    ) {
      return 'EXAM_SCHEDULED';
    }

    return 'APPLICATION_CLOSED';
  }

  // Fallback for records with legacy lifecycleStatus
  if (rec.lifecycleStatus === 'OPEN') return 'APPLICATION_OPEN';
  if (rec.lifecycleStatus === 'CLOSING_SOON') return 'APPLICATION_CLOSING';
  if (rec.lifecycleStatus === 'UPCOMING') return 'NOT_STARTED';
  if (rec.lifecycleStatus === 'CLOSED') return 'APPLICATION_CLOSED';
  if (rec.lifecycleStatus === 'EXAM_SCHEDULED') return 'EXAM_SCHEDULED';

  return 'NOT_STARTED';
}

/**
 * Converts a canonical lifecycle state into UI presentation badges and labels.
 */
export function getLifecyclePresentation(
  lifecycle: CanonicalLifecycle,
  options: { admin?: boolean } = {}
): StatusPresentation {
  switch (lifecycle) {
    case 'NOT_STARTED':
      return {
        canonicalState: 'NOT_STARTED',
        label: options.admin ? 'Upcoming (Not Started)' : 'Upcoming',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        isLiveApplication: false,
        description: 'Application registration has not opened yet.',
      };

    case 'APPLICATION_OPEN':
      return {
        canonicalState: 'APPLICATION_OPEN',
        label: options.admin ? 'Application Open' : 'Applications Open',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        isLiveApplication: true,
        description: 'Online application portal is active.',
      };

    case 'APPLICATION_CLOSING':
      return {
        canonicalState: 'APPLICATION_CLOSING',
        label: 'Closing Soon',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
        isLiveApplication: true,
        description: `Applications close within ${CLOSING_SOON_THRESHOLD_DAYS} days.`,
      };

    case 'APPLICATION_CLOSED':
      return {
        canonicalState: 'APPLICATION_CLOSED',
        label: 'Applications Closed',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        isLiveApplication: false,
        description: 'Application window has concluded. Awaiting examination schedule.',
      };

    case 'EXAM_SCHEDULED':
      return {
        canonicalState: 'EXAM_SCHEDULED',
        label: 'Exam Scheduled',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
        isLiveApplication: false,
        description: 'Written examination or CBT date is gazetted.',
      };

    case 'EXAM_COMPLETED':
      return {
        canonicalState: 'EXAM_COMPLETED',
        label: 'Exam Concluded',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        isLiveApplication: false,
        description: 'Examination completed; answer key scrutiny/evaluation underway.',
      };

    case 'RESULT_DECLARED':
      return {
        canonicalState: 'RESULT_DECLARED',
        label: 'Result Declared',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 font-semibold',
        isLiveApplication: false,
        description: 'Official selection list or merit roster has been announced.',
      };

    default:
      return {
        canonicalState: 'NOT_STARTED',
        label: 'Upcoming',
        badgeClass: 'bg-muted text-muted-foreground border-border',
        isLiveApplication: false,
        description: 'Awaiting gazette notification.',
      };
  }
}

/**
 * Checks if a recruitment is a published "Active Drive" (candidates can actively apply right now).
 */
export function isActiveDrive(rec: MinimalRecruitmentInput, referenceDateInput?: Date | string): boolean {
  if (rec.status && rec.status !== 'PUBLISHED') return false;
  const lifecycle = resolveRecruitmentLifecycle(rec, referenceDateInput);
  return lifecycle === 'APPLICATION_OPEN' || lifecycle === 'APPLICATION_CLOSING';
}

/**
 * Checks if a recruitment is a published "Upcoming Drive" (announced but portal not open yet).
 */
export function isUpcomingDrive(rec: MinimalRecruitmentInput, referenceDateInput?: Date | string): boolean {
  if (rec.status && rec.status !== 'PUBLISHED') return false;
  const lifecycle = resolveRecruitmentLifecycle(rec, referenceDateInput);
  return lifecycle === 'NOT_STARTED';
}

/**
 * Checks if a recruitment is a "Current Recruitment" (published and not archived).
 */
export function isCurrentRecruitment(rec: MinimalRecruitmentInput): boolean {
  if (!rec.status) return true;
  return rec.status === 'PUBLISHED';
}

/**
 * Centralized platform metrics calculator.
 * Strictly guarantees that non-active vacancies (e.g. result declared or exam stage)
 * are NEVER counted as active vacancies.
 */
export function calculateRecruitmentMetrics(
  recruitments: MinimalRecruitmentInput[],
  referenceDateInput?: Date | string
): RecruitmentMetrics {
  let totalAnnouncedVacancies = 0;
  let activeDriveCount = 0;
  let activeVacancyCount = 0;
  let upcomingDriveCount = 0;
  let upcomingVacancyCount = 0;
  let examScheduledDriveCount = 0;
  let examScheduledVacancyCount = 0;
  let resultDeclaredDriveCount = 0;
  let resultDeclaredVacancyCount = 0;
  let currentRecruitmentCount = 0;
  let currentVacancyCount = 0;

  for (const rec of recruitments) {
    // Only published records contribute to public metrics
    const isPub = !rec.status || rec.status === 'PUBLISHED';
    if (!isPub) continue;

    const vacancies = typeof rec.totalVacancies === 'number' && rec.totalVacancies > 0 ? rec.totalVacancies : 0;
    totalAnnouncedVacancies += vacancies;

    currentRecruitmentCount++;
    currentVacancyCount += vacancies;

    const lifecycle = resolveRecruitmentLifecycle(rec, referenceDateInput);

    switch (lifecycle) {
      case 'APPLICATION_OPEN':
      case 'APPLICATION_CLOSING':
        activeDriveCount++;
        activeVacancyCount += vacancies;
        break;

      case 'NOT_STARTED':
        upcomingDriveCount++;
        upcomingVacancyCount += vacancies;
        break;

      case 'EXAM_SCHEDULED':
      case 'APPLICATION_CLOSED':
        examScheduledDriveCount++;
        examScheduledVacancyCount += vacancies;
        break;

      case 'EXAM_COMPLETED':
      case 'RESULT_DECLARED':
        resultDeclaredDriveCount++;
        resultDeclaredVacancyCount += vacancies;
        break;
    }
  }

  return {
    totalAnnouncedVacancies,
    activeDriveCount,
    activeVacancyCount,
    upcomingDriveCount,
    upcomingVacancyCount,
    examScheduledDriveCount,
    examScheduledVacancyCount,
    resultDeclaredDriveCount,
    resultDeclaredVacancyCount,
    currentRecruitmentCount,
    currentVacancyCount,
  };
}

/**
 * Formats the sector discovery summary header metric string per user locked design:
 * Example: "1 Active Drive · 8,350 Total Vacancies (850 Open Now)"
 */
export function formatSectorVacancySummary(metrics: RecruitmentMetrics): string {
  const driveLabel = metrics.activeDriveCount === 1 ? '1 Active Drive' : `${metrics.activeDriveCount} Active Drives`;
  const totalFormatted = metrics.totalAnnouncedVacancies.toLocaleString();
  const openFormatted = metrics.activeVacancyCount.toLocaleString();

  return `${driveLabel} · ${totalFormatted} Total Vacancies (${openFormatted} Open Now)`;
}

export interface MilestonePresentation {
  label: string;
  badgeClass: string;
  isUrgent: boolean;
  isPast: boolean;
  category: 'CLOSING_SOON' | 'OPEN_NOW' | 'UPCOMING' | 'EXAM' | 'PAST';
}

/**
 * Resolves the milestone status for calendar/timeline events relative to a reference date.
 */
export function resolveMilestonePresentation(
  rawDate: string | null | undefined,
  eventType: 'APPLICATION_START' | 'APPLICATION_END' | 'EXAM_DATE' | 'NOTIFICATION',
  referenceDateInput?: Date | string
): MilestonePresentation {
  const refDateStr = normalizeDateString(referenceDateInput) || new Date().toISOString().split('T')[0];
  const dateStr = normalizeDateString(rawDate);

  if (!dateStr) {
    return {
      label: 'Date TBA',
      badgeClass: 'bg-muted text-muted-foreground border-border',
      isUrgent: false,
      isPast: false,
      category: 'UPCOMING',
    };
  }

  const isPast = refDateStr > dateStr;

  if (eventType === 'APPLICATION_END') {
    if (isPast) {
      return {
        label: 'Closed',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
        isUrgent: false,
        isPast: true,
        category: 'PAST',
      };
    }

    const endTimestamp = new Date(`${dateStr}T23:59:59Z`).getTime();
    const refTimestamp = new Date(`${refDateStr}T00:00:00Z`).getTime();
    const diffDays = Math.ceil((endTimestamp - refTimestamp) / (1000 * 60 * 60 * 24));

    if (diffDays <= CLOSING_SOON_THRESHOLD_DAYS) {
      return {
        label: 'Closing Soon',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse font-bold',
        isUrgent: true,
        isPast: false,
        category: 'CLOSING_SOON',
      };
    }

    return {
      label: 'Applications Open',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
      isUrgent: false,
      isPast: false,
      category: 'OPEN_NOW',
    };
  }

  if (eventType === 'APPLICATION_START') {
    if (isPast) {
      return {
        label: 'Applications Open',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
        isUrgent: false,
        isPast: false,
        category: 'OPEN_NOW',
      };
    }
    return {
      label: 'Upcoming',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-medium',
      isUrgent: false,
      isPast: false,
      category: 'UPCOMING',
    };
  }

  if (eventType === 'EXAM_DATE') {
    if (isPast) {
      return {
        label: 'Exam Concluded',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        isUrgent: false,
        isPast: true,
        category: 'PAST',
      };
    }
    return {
      label: 'Exam Scheduled',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',
      isUrgent: false,
      isPast: false,
      category: 'EXAM',
    };
  }

  return {
    label: isPast ? 'Completed' : 'Upcoming',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    isUrgent: false,
    isPast,
    category: isPast ? 'PAST' : 'UPCOMING',
  };
}

