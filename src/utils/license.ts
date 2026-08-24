/**
 * License validation against the backend.
 *
 * NOTE: set this to a stable production domain. The URLs currently hardcoded
 * in public/success.js and src/background/index.ts are per-deployment Vercel
 * preview URLs, which change on every deploy and will strand existing installs.
 */
export const API_BASE = 'https://gmail-unlimited.vercel.app';

type ValidationResult =
  | { status: 'valid' }
  | { status: 'invalid' }
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
