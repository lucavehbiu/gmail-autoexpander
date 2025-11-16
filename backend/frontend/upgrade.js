// Stripe configuration
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51MHROGHxoVVhhFnv0TvRIRuuzdTcvSVCBGIo4yfXOKCWlDqXUCRp0SFZ11fn6ouZq8Ea7x052hNb7QG7JX6KF9Nu00l0GPIm29';

// Get extension ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const extensionId = urlParams.get('ext_id');

if (!extensionId) {
  alert('Invalid access. Please use the upgrade button in the extension.');
}

const checkoutBtn = document.getElementById('checkout-btn');
const loading = document.getElementById('loading');
const errorDiv = document.getElementById('error');

// Initialize Stripe
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

checkoutBtn.addEventListener('click', async () => {
  checkoutBtn.disabled = true;
  loading.classList.add('active');
  errorDiv.classList.remove('active');

  try {
    // Get current page origin for return URL
    const currentOrigin = window.location.origin;
    const returnUrl = `${currentOrigin}/success.html`;

    // Call backend to create checkout session
    const response = await fetch('https://gmail-autoexpander-jinxgepkr-lucas-projects-7cbc24c5.vercel.app/api/create-checkout', {
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

    const { sessionId } = await response.json();

    // Redirect to Stripe Checkout using Stripe.js
    const { error } = await stripe.redirectToCheckout({ sessionId });

    if (error) {
      throw error;
    }

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
