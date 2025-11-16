// Get session ID and extension ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const extensionId = urlParams.get('ext_id');

if (!extensionId) {
  document.getElementById('license-key').textContent = 'Error: Extension ID not found';
}

async function activateLicense() {
  try {
    // Verify payment and get license key from backend
    const response = await fetch('https://gmail-autoexpander-jinxgepkr-lucas-projects-7cbc24c5.vercel.app/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    const { licenseKey } = await response.json();

    // Display license key
    document.getElementById('license-key').textContent = licenseKey;

    // Send message to extension to activate premium
    try {
      chrome.runtime.sendMessage(extensionId, {
        type: 'ACTIVATE_PREMIUM',
        licenseKey: licenseKey,
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Extension messaging error:', chrome.runtime.lastError);
        } else if (response && response.success) {
          console.log('License activated successfully in extension!');
        }
      });
    } catch (err) {
      console.error('Failed to message extension:', err);
    }

    // Setup copy button
    document.getElementById('copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(licenseKey);
      const btn = document.getElementById('copy-btn');
      btn.textContent = 'Copied ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy License Key';
        btn.classList.remove('copied');
      }, 2000);
    });

  } catch (error) {
    console.error('Activation error:', error);
    document.getElementById('license-key').textContent = 'Error activating license. Please contact support.';
  }
}

if (sessionId) {
  activateLicense();
} else {
  document.getElementById('license-key').textContent = 'No session ID found';
}

// Close button handler
document.getElementById('close-btn').addEventListener('click', () => {
  window.close();
});
