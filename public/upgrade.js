const checkoutBtn = document.getElementById('checkout-btn');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

checkoutBtn.addEventListener('click', async () => {
  checkoutBtn.disabled = true;
  loading.classList.add('active');
  errorDiv.classList.remove('active');

  try {
    // Get extension ID for return URL
    const extensionId = chrome.runtime.id;
    const returnUrl = chrome.runtime.getURL('success.html');

    // Call backend to create checkout session
    const response = await fetch('https://gmail-autoexpander-gik5v7s01-lucas-projects-7cbc24c5.vercel.app/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extensionId: extensionId,
        returnUrl: returnUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();

    // Redirect to Stripe Checkout URL
    window.location.href = url;

  } catch (error) {
    console.error('Checkout error:', error);
    showError(error.message || 'Something went wrong. Please try again.');
    checkoutBtn.disabled = false;
    loading.classList.remove('active');
  }
});

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.classList.add('active');
}
