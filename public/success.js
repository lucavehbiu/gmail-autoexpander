// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');

async function activateLicense() {
  try {
    // Verify payment and get license key from your backend
    const response = await fetch('https://gmail-autoexpander-gik5v7s01-lucas-projects-7cbc24c5.vercel.app/api/verify-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    const { licenseKey } = await response.json();

    // Display license key
    document.getElementById('license-key').textContent = licenseKey;

    // Activate in extension
    chrome.runtime.sendMessage({
      type: 'ACTIVATE_PREMIUM',
      licenseKey: licenseKey,
    }, (response) => {
      if (response && response.success) {
        console.log('License activated successfully!');
      }
    });

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
