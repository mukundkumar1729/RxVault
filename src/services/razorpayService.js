/**
 * 💳 Razorpay Frontend Service
 * Handles script loading and checkout flow.
 * Bridges to Supabase Edge Functions for secure operations.
 */
import { db } from '../core/db.js';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Loads the Razorpay SDK if not already present.
 */
export const loadRazorpay = () => {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement('script');
        script.src = RAZORPAY_CHECKOUT_URL;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
};

/**
 * Starts the upgrade flow.
 */
export const startUpgradeFlow = async (clinicId, plan, user) => {
    try {
        if (typeof window.showLoading === 'function') window.showLoading('Preparing secure payment…');

        // 0. Ensure SDK is loaded
        const sdkLoaded = await loadRazorpay();
        if (!sdkLoaded) throw new Error("Could not load Razorpay SDK. Check your internet connection.");

        // 1. Create order via Edge Function (Using SDK to handle Publishable Key headers)
        const { data, error } = await db.functions.invoke('razorpay', {
            body: { action: 'create-order', clinicId, plan }
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        if (typeof window.hideLoading === 'function') window.hideLoading();

        // 2. Open Razorpay Checkout
        const options = {
            key: data.razorpay_key_id || 'rzp_test_placeholder', 
            amount: data.amount,
            currency: 'INR',
            name: 'RxVault Pro',
            description: `Upgrade to ${plan.toUpperCase()} Plan`,
            order_id: data.id,
            prefill: {
                name: user?.name,
                email: user?.email
            },
            theme: { color: '#0a7c6e' },
            handler: async (response) => {
                // 3. Verify payment via Edge Function
                await verifyPayment(clinicId, plan, {
                    orderId: data.id,
                    paymentId: response.razorpay_payment_id,
                    signature: response.razorpay_signature
                });
            },
            modal: {
                ondismiss: () => {
                    if (typeof window.showToast === 'function') window.showToast('Payment cancelled', 'info');
                }
            }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();

    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('[Razorpay] flow error detailed:', error);
        
        let msg = error.message;
        
        // If it's a Supabase Function error, sometimes the body is not in .message
        // but the SDK handles the status. We want to show the status or context.
        if (error.context && error.context.statusText) {
            msg = `${error.context.status} ${error.context.statusText}`;
        }

        if (typeof window.showToast === 'function') window.showToast('Payment initialization failed: ' + msg, 'error');
    }
};

/**
 * Calls the verify action on the Edge Function.
 */
const verifyPayment = async (clinicId, plan, details) => {
    try {
        if (typeof window.showLoading === 'function') window.showLoading('Verifying payment…');

        const { data, error } = await db.functions.invoke('razorpay', {
            body: {
                action: 'verify-payment',
                clinicId,
                plan,
                ...details
            }
        });

        if (error) throw error;
        if (typeof window.hideLoading === 'function') window.hideLoading();

        if (data && data.success) {
            if (typeof window.showToast === 'function') window.showToast(`Plan successfully upgraded to ${plan.toUpperCase()}!`, 'success');
            // Refresh clinic data/UI
            if (typeof window.initClinicGate === 'function') window.initClinicGate();
        } else {
            throw new Error((data && data.error) || 'Verification failed');
        }
    } catch (error) {
        if (typeof window.hideLoading === 'function') window.hideLoading();
        console.error('[Razorpay] verification error:', error);
        if (typeof window.showToast === 'function') window.showToast('Verification error: ' + error.message, 'error');
    }
};
