/**
 * Payment Processing - eSewa & Khalti APIs
 * Nepalese subscription billing & payouts
 * Cost: 2.0% transaction fee
 */

export type PaymentProvider = "esewa" | "khalti";

export interface PaymentInitiationRequest {
  provider: PaymentProvider;
  amount: number;
  currency: "NPR" | "USD";
  orderId: string;
  customerInfo: {
    name: string;
    email: string;
    phone: string;
  };
  returnUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitiationResponse {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  error?: string;
}

export interface PaymentVerificationRequest {
  provider: PaymentProvider;
  paymentId: string;
  orderId: string;
}

export interface PaymentVerificationResponse {
  success: boolean;
  verified: boolean;
  transactionId?: string;
  amount?: number;
  error?: string;
}

export interface SubscriptionRequest {
  provider: PaymentProvider;
  planId: string;
  customerId: string;
  amount: number;
  interval: "monthly" | "yearly";
  trialDays?: number;
}

export interface SubscriptionResponse {
  success: boolean;
  subscriptionId?: string;
  status?: "active" | "trialing" | "past_due" | "canceled";
  error?: string;
}

export class ESewaClient {
  private merchantId: string;
  private secretKey: string;
  private baseUrl: string;
  private testMode: boolean;

  constructor() {
    this.merchantId = process.env.ESEWA_MERCHANT_ID!;
    this.secretKey = process.env.ESEWA_SECRET_KEY!;
    this.testMode = process.env.ESEWA_TEST_MODE !== "false";
    this.baseUrl = this.testMode
      ? "https://uat.esewa.com.np/epay/main"
      : "https://esewa.com.np/epay/main";
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const payload: Record<string, string> = {
      amt: String(request.amount),
      psc: "0",
      pdc: "0",
      txAmt: "0",
      tAmt: String(request.amount),
      pid: request.orderId,
      scd: this.merchantId,
      su: request.returnUrl,
      fu: request.cancelUrl,
    };

    const formData = new URLSearchParams(payload).toString();
    const paymentUrl = `${this.baseUrl}?${formData}`;

    return {
      success: true,
      paymentUrl,
      paymentId: request.orderId,
    };
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    const response = await fetch("https://uat.esewa.com.np/epay/transrec", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        amt: "0",
        rid: request.paymentId,
        pid: request.orderId,
        scd: this.merchantId,
      }).toString(),
    });

    const text = await response.text();
    const verified = text.includes("<status>Success</status>");

    return {
      success: true,
      verified,
      transactionId: request.paymentId,
    };
  }

  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse> {
    return {
      success: false,
      error: "eSewa subscription requires manual setup via merchant dashboard",
    };
  }
}

export class KhaltiClient {
  private secretKey: string;
  private publicKey: string;
  private baseUrl: string;
  private testMode: boolean;

  constructor() {
    this.secretKey = process.env.KHALTI_SECRET_KEY!;
    this.publicKey = process.env.KHALTI_PUBLIC_KEY!;
    this.testMode = process.env.KHALTI_TEST_MODE !== "false";
    this.baseUrl = this.testMode
      ? "https://khalti.com/api/v2"
      : "https://khalti.com/api/v2";
  }

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    const response = await fetch(`${this.baseUrl}/payment/initiate/`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        return_url: request.returnUrl,
        website_url: request.cancelUrl,
        amount: Math.round(request.amount * 100),
        purchase_order_id: request.orderId,
        purchase_order_name: `OmniGEO ${request.metadata?.plan || "Subscription"}`,
        customer_info: {
          name: request.customerInfo.name,
          email: request.customerInfo.email,
          phone: request.customerInfo.phone,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.detail || "Khalti initiation failed" };
    }

    return {
      success: true,
      paymentUrl: data.payment_url,
      paymentId: data.pidx,
    };
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    const response = await fetch(`${this.baseUrl}/payment/lookup/`, {
      method: "POST",
      headers: {
        Authorization: `Key ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pidx: request.paymentId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.detail, verified: false };
    }

    return {
      success: true,
      verified: data.status === "Completed",
      transactionId: data.transaction_id,
      amount: data.amount / 100,
    };
  }

  async createSubscription(request: SubscriptionRequest): Promise<SubscriptionResponse> {
    return {
      success: false,
      error: "Khalti subscriptions require manual setup via merchant dashboard",
    };
  }
}

let esewaClient: ESewaClient | null = null;
let khaltiClient: KhaltiClient | null = null;

export function getESewaClient(): ESewaClient {
  if (!esewaClient) esewaClient = new ESewaClient();
  return esewaClient;
}

export function getKhaltiClient(): KhaltiClient {
  if (!khaltiClient) khaltiClient = new KhaltiClient();
  return khaltiClient;
}

export function getPaymentClient(provider: PaymentProvider): ESewaClient | KhaltiClient {
  return provider === "esewa" ? getESewaClient() : getKhaltiClient();
}

/**
 * Calculate transaction fee
 * Cost: 2.0% transaction fee
 */
export function calculateTransactionFee(amount: number): number {
  return amount * 0.02;
}

/**
 * Estimate monthly subscription cost in NPR
 */
export function estimateMonthlyCost(plan: "starter" | "pro" | "enterprise", provider: PaymentProvider): number {
  const basePrices = { starter: 4999, pro: 12999, enterprise: 29999 };
  const base = basePrices[plan];
  const fee = calculateTransactionFee(base);
  return Math.round(base + fee);
}