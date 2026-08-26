// Hosted upgrade page. Opened by the extension with ?ext_id=<extension id> so
// the success page can message the right installation afterwards.
const urlParams = new URLSearchParams(window.location.search);
const extensionId = urlParams.get('ext_id');

const checkoutBtn = document.getElementById('checkout-btn');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

checkoutBtn.addEventListener('click', async () => {
  checkoutBtn.disabled = true;
  loading.classList.add('active');
  errorDiv.classList.remove('active');

  try {
    // create-checkout appends ?session_id=… and derives the cancel URL by
    // swapping success.html for upgrade.html, so this must stay query-free.
    const returnUrl = `${window.location.origin}/success.html`;

    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extensionId, returnUrl }),
    });

    if (!response.ok) {
      throw new Error('Could not start checkout. Please try again.');
    }

    // Redirect straight to the Checkout URL Stripe handed the backend. Using
    // the URL rather than Stripe.js keeps the publishable key off this page.
    const { url } = await response.json();
    if (!url) {
      throw new Error('Could not start checkout. Please try again.');
    }

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
