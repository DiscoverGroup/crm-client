export type PaymentDetail = {
  date: string;
  depositSlip?: File | null;
  receipt?: File | null;
};

export interface AdditionalPayment {
  enabled: boolean;
  date: string;
  depositSlip?: File | null;
  receipt?: File | null;
}

export interface OtherPayments {
  enabled: boolean;
  description: string;
  attachment?: File | null;
}

export interface PaymentData {
  paymentTerm: string;
  termCount: number;
  selectedPaymentBox: number | null;
  paymentDetails: PaymentDetail[];
  additionalPayments: {
    firstPayment: AdditionalPayment;
    secondPayment: Omit<AdditionalPayment, 'enabled'>;
    thirdPayment: Omit<AdditionalPayment, 'enabled'>;
    otherPayments: OtherPayments;
  };
}

export interface SerializedPaymentData {
  paymentTerm: string;
  termCount: number;
  selectedPaymentBox: number | null;
  paymentDetails: Array<{
    date: string;
    depositSlip: string | null;
    receipt: string | null;
  }>;
  additionalPayments: {
    firstPayment: {
      enabled: boolean;
      date: string;
      depositSlip: string | null;
      receipt: string | null;
    };
    secondPayment: {
      date: string;
      depositSlip: string | null;
      receipt: string | null;
    };
    thirdPayment: {
      date: string;
      depositSlip: string | null;
      receipt: string | null;
    };
    otherPayments: {
      enabled: boolean;
      description: string;
      attachment: string | null;
    };
  };
}