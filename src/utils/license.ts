/**
 * License validation and recovery against the backend.
 *
 * Single production host. The per-deployment Vercel preview URLs that used to
 * be hardcoded here, in public/success.js and in the background worker changed
 * on every deploy and stranded existing installs.
 */
export const API_BASE = 'https://gmail-autoexpander.vercel.app';

type ValidationResult =
  | { status: 'valid' }
  | { status: 'invalid' }
  | { status: 'unreachable' };

export type RecoveryResult =
  | { status: 'found'; licenseKeys: string[] }
  | { status: 'not-found' }
  | { status: 'rate-limited' }
  | { status: 'unreachable' };

/**
 * Ask the backend whether a key is real and still active.
 *
 * 'unreachable' is kept distinct from 'invalid' on purpose: a customer who is
 * offline, or who hits a backend outage, must not silently lose premium they
 * paid for. Callers decide how to treat it.
 */
export async function validateLicenseKey(
  licenseKey: string
): Promise<ValidationResult> {
  try {
    const response = await fetch(`${API_BASE}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey }),
    });

    if (!response.ok) {
      // 5xx means the validator itself is broken, not that the key is fake.
      return response.status >= 500
        ? { status: 'unreachable' }
        : { status: 'invalid' };
    }

    const data = await response.json();
    return data.valid === true ? { status: 'valid' } : { status: 'invalid' };
  } catch (error) {
    console.error('[License] Validation request failed:', error);
    return { status: 'unreachable' };
  }
}

/**
 * Look a key up by the email the purchase was made with.
 *
 * This is the escape hatch for customers who bought before licenses were
 * stored: the key sitting in their browser is not the key the backfill
 * recorded, so validation will reject it and only a lookup can reunite them.
 */
export async function recoverLicense(email: string): Promise<RecoveryResult> {
  try {
    const response = await fetch(`${API_BASE}/api/recover-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (response.status === 429) {
      return { status: 'rate-limited' };
    }

    if (response.status === 404) {
      return { status: 'not-found' };
    }

    if (!response.ok) {
      return { status: 'unreachable' };
    }

    const data = await response.json();
    const keys: string[] = Array.isArray(data.licenseKeys) ? data.licenseKeys : [];

    return keys.length > 0
      ? { status: 'found', licenseKeys: keys }
      : { status: 'not-found' };
  } catch (error) {
    console.error('[License] Recovery request failed:', error);
    return { status: 'unreachable' };
  }
}
