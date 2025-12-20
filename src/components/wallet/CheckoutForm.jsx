import React, { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CheckoutForm({ onSuccess, onCancel, returnUrl }) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useLanguage();

  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded.
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl || `${window.location.origin}/wallet?checkout=success`,
      },
    });

    // This point will only be reached if there is an immediate error when
    // confirming the payment. Otherwise, your customer will be redirected to
    // your `return_url`. For some payment methods like iDEAL, your customer will
    // be redirected to an intermediate site first to authorize the payment, then
    // redirected to the `return_url`.
    if (error.type === 'card_error' || error.type === 'validation_error') {
      setMessage(error.message);
    } else {
      setMessage(t('wallet.checkout.unexpectedError'));
    }

    setIsLoading(false);
  };

  return (
    <form id="payment-form" onSubmit={handleSubmit}>
      <PaymentElement id="payment-element" options={{ layout: 'tabs' }} />
      <div className="flex items-center justify-end gap-2 mt-6">
        <Button variant="outline" type="button" onClick={onCancel} disabled={isLoading}>
          {t('wallet.checkout.cancel')}
        </Button>
        <Button type="submit" disabled={isLoading || !stripe || !elements}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('wallet.checkout.processing')}
            </>
          ) : (
            t('wallet.checkout.payNow')
          )}
        </Button>
      </div>

      {/* Show any error or success messages */}
      {message && <div id="payment-message" className="text-red-500 text-sm mt-2">{message}</div>}
    </form>
  );
}
