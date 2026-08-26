// Post-checkout page. Stripe sends the buyer here with the session id, and
// ext_id identifies the installation that started the purchase.
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const extensionId = urlParams.get('ext_id');

const keyEl = document.getElementById('license-key');
const copyBtn = document.getElementById('copy-btn');
const closeBtn = document.getElementById('close-btn');

function showKey(licenseKey) {
  keyEl.textContent = licenseKey;
  keyEl.dataset.state = 'ready';
  copyBtn.disabled = false;
}

function showProblem(message) {
  keyEl.textContent = message;
  keyEl.dataset.state = 'error';
  copyBtn.disabled = true;
}

/**
 * Hand the key to the extension so the customer never has to type it.
 *
 * Best-effort by design: this page is also reachable from a browser where the
 * extension is not installed, and the key on screen still works there.
 */
function activateInExtension(licenseKey) {
  if (!extensionId || typeof chrome === 'undefined' || !chrome.runtime) {
    return;
  }

  try {
    chrome.runtime.sendMessage(
      extensionId,
      { type: 'ACTIVATE_PREMIUM', licenseKey },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('Extension messaging failed:', chrome.runtime.lastError);
        }
      }
    );
  } catch (error) {
    console.warn('Could not reach the extension:', error);
  }
}

async function claimLicense() {
  try {
    const response = await fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      throw new Error(`verify-payment returned ${response.status}`);
    }

    const { licenseKey } = await response.json();

    if (!licenseKey) {
      throw new Error('No license key in response');
    }

    showKey(licenseKey);
    activateInExtension(licenseKey);
  } catch (error) {
    console.error('Activation error:', error);
    // The payment went through regardless — say so, and point at recovery
    // rather than implying the money is gone.
    showProblem(
      'Your payment went through, but we could not show the key here. Open the extension, choose "Lost your key?", and enter the email you paid with.'
    );
  }
}

copyBtn.disabled = true;

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(keyEl.textContent.trim());
    copyBtn.textContent = 'Copied';
    copyBtn.dataset.copied = 'true';
    setTimeout(() => {
      copyBtn.textContent = 'Copy key';
      delete copyBtn.dataset.copied;
    }, 1600);
  } catch (error) {
    console.error('Copy failed:', error);
  }
});

closeBtn.addEventListener('click', () => {
  // window.close() only works on tabs script-opened by the same context, which
  // this one is not. Send them where they actually want to be instead.
  window.location.href = 'https://mail.google.com/';
});

if (sessionId) {
  claimLicense();
} else {
  showProblem('This page needs to be opened from the Stripe receipt link.');
}
