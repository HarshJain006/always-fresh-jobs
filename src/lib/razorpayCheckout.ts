declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => { open: () => void };
  }
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { email?: string; name?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay checkout runs in the browser only."));
  }
  if (window.Razorpay) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay checkout.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout."));
    document.body.appendChild(script);
  });
}

export function openRazorpayCheckout(options: RazorpayCheckoutOptions): Promise<{
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}> {
  return loadRazorpayCheckoutScript().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.Razorpay) {
          reject(new Error("Razorpay checkout is unavailable."));
          return;
        }

        const rzp = new window.Razorpay({
          ...options,
          handler: (response) => resolve(response),
          modal: {
            ...options.modal,
            ondismiss: () => reject(new Error("Payment cancelled.")),
          },
        });
        rzp.open();
      }),
  );
}
