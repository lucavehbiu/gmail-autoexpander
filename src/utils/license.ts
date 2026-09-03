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
 * Did this response actually come from our handler, or from something in
 * front of it?
 *
 * A misrouted deploy answers with Vercel's own HTML 404, a proxy or captive
 * portal answers with a login page, an outage answers with a gateway error
 * page. None of those are the validator saying no, and the difference decides
 * whether a paying customer keeps what they bought. Our handlers always answer
 * in JSON, so a body that will not parse means we never reached one.
 */
async function readJson(response: Response): Promise<any | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Ask the backend whether a key is real and still active.
 *
 * Exactly one response means "this key is not valid": a 200 from our handler
 * carrying valid:false. Every other outcome — offline, 404, 405, 429, 5xx,
 * an HTML error page — is 'unreachable', because revalidateStoredLicense
 * revokes premium on 'invalid' and nothing but the database should be able to
 * do that. A misrouted deploy on 2026-08-26 returned 404 here, which the old
 * `status < 500 ? invalid` rule read as a fake key.
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

    const data = await readJson(response);

    if (response.status !== 200 || typeof data?.valid !== 'boolean') {
      console.error('[License] Validator did not answer:', response.status);
      return { status: 'unreachable' };
    }

    return data.valid ? { status: 'valid' } : { status: 'invalid' };
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
 *
 * The status codes are only trusted once the body proves our handler produced
 * them — otherwise a routing 404 tells someone their purchase does not exist.
 */
export async function recoverLicense(email: string): Promise<RecoveryResult> {
  try {
    const response = await fetch(`${API_BASE}/api/recover-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await readJson(response);

    if (data === null) {
      console.error('[License] Recovery did not answer:', response.status);
      return { status: 'unreachable' };
    }

    if (response.status === 429) {
      return { status: 'rate-limited' };
    }

    if (response.status === 404) {
      return { status: 'not-found' };
    }

    if (response.status !== 200) {
      return { status: 'unreachable' };
    }

    const keys: string[] = Array.isArray(data.licenseKeys) ? data.licenseKeys : [];

    return keys.length > 0
      ? { status: 'found', licenseKeys: keys }
      : { status: 'not-found' };
  } catch (error) {
    console.error('[License] Recovery request failed:', error);
    return { status: 'unreachable' };
  }
}
