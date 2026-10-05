/** Failure alerts by email (Resend HTTPS API: works without owning a domain). Always also visible in the Run Log. */
export interface AlertEnv { RESEND_API_KEY?: string; ALERT_FROM?: string }

export async function sendAlert(env: AlertEnv, to: string, subject: string, lines: string[]): Promise<boolean> {
  const text = lines.join('\n').slice(0, 8000);
  console.error(`[pipeline-alert] ${subject}\n${text}`);
  if (!env.RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.ALERT_FROM || 'NIRNAY Pipeline <onboarding@resend.dev>', to: [to], subject: `[NIRNAY] ${subject}`, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error('[pipeline-alert] email failed', e);
    return false;
  }
}
