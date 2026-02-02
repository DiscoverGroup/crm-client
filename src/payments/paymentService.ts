// Local type definitions to avoid external dependency on ../types/payment
import { FileService } from '../services/fileService';
import { MongoDBService } from '../services/mongoDBService';

type NamedFile = { name: string; id?: string } | null;

export interface PaymentDetail {
  depositSlip?: NamedFile;
  receipt?: NamedFile;
  [key: string]: unknown;
}

export interface OtherPayments {
  attachment?: NamedFile;
  [key: string]: unknown;
}

export interface AdditionalPayment {
  depositSlip?: NamedFile;
  receipt?: NamedFile;
  [key: string]: unknown;
}

export interface AdditionalPayments {
  firstPayment: AdditionalPayment;
  secondPayment: AdditionalPayment;
  thirdPayment: AdditionalPayment;
  otherPayments: OtherPayments;
}

export interface PaymentData {
  paymentDetails: PaymentDetail[];
  additionalPayments: AdditionalPayments;
  [key: string]: unknown;
}

export interface SerializedPaymentDetail {
  depositSlip?: string | null; // File ID
  receipt?: string | null; // File ID
  [key: string]: unknown;
}

export interface SerializedOtherPayments {
  attachment?: string | null; // File ID
  [key: string]: unknown;
}

export interface SerializedAdditionalPayment {
  depositSlip?: string | null; // File ID
  receipt?: string | null; // File ID
  [key: string]: unknown;
}

export interface SerializedAdditionalPayments {
  firstPayment: SerializedAdditionalPayment;
  secondPayment: SerializedAdditionalPayment;
  thirdPayment: SerializedAdditionalPayment;
  otherPayments: SerializedOtherPayments;
}

export interface SerializedPaymentData {
  paymentDetails: SerializedPaymentDetail[];
  additionalPayments: SerializedAdditionalPayments;
  [key: string]: unknown;
}

export class PaymentService {
  private static STORAGE_KEY = 'crm_payment_data';

  static async savePaymentData(data: PaymentData, clientId?: string): Promise<boolean> {
    try {
      // Save files and get their IDs
      const serializedData: SerializedPaymentData = {
        ...data,
        paymentDetails: await Promise.all(data.paymentDetails.map(async (detail, index) => ({
          ...detail,
          depositSlip: detail.depositSlip ? await this.saveFile(detail.depositSlip, 'deposit-slip', index, 'regular', clientId) : null,
          receipt: detail.receipt ? await this.saveFile(detail.receipt, 'receipt', index, 'regular', clientId) : null,
        }))),
        additionalPayments: {
          ...data.additionalPayments,
          firstPayment: {
            ...data.additionalPayments.firstPayment,
            depositSlip: data.additionalPayments.firstPayment.depositSlip ?
              await this.saveFile(data.additionalPayments.firstPayment.depositSlip, 'deposit-slip', undefined, 'first', clientId) : null,
            receipt: data.additionalPayments.firstPayment.receipt ?
              await this.saveFile(data.additionalPayments.firstPayment.receipt, 'receipt', undefined, 'first', clientId) : null,
          },
          secondPayment: {
            ...data.additionalPayments.secondPayment,
            depositSlip: data.additionalPayments.secondPayment.depositSlip ?
              await this.saveFile(data.additionalPayments.secondPayment.depositSlip, 'deposit-slip', undefined, 'second', clientId) : null,
            receipt: data.additionalPayments.secondPayment.receipt ?
              await this.saveFile(data.additionalPayments.secondPayment.receipt, 'receipt', undefined, 'second', clientId) : null,
          },
          thirdPayment: {
            ...data.additionalPayments.thirdPayment,
            depositSlip: data.additionalPayments.thirdPayment.depositSlip ?
              await this.saveFile(data.additionalPayments.thirdPayment.depositSlip, 'deposit-slip', undefined, 'third', clientId) : null,
            receipt: data.additionalPayments.thirdPayment.receipt ?
              await this.saveFile(data.additionalPayments.thirdPayment.receipt, 'receipt', undefined, 'third', clientId) : null,
          },
          otherPayments: {
            ...data.additionalPayments.otherPayments,
            attachment: data.additionalPayments.otherPayments.attachment ? 
              await this.saveFile(data.additionalPayments.otherPayments.attachment, 'other', undefined, 'other', clientId) : null,
          },
        },
      };

      // Store payment data with clientId if provided
      const allPayments = this.getAllPaymentData();
      if (clientId) {
        allPayments[clientId] = serializedData;
      } else {
        // Fallback for backward compatibility
        allPayments['default'] = serializedData;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allPayments));
      
      // Sync to MongoDB if clientId is provided
      if (clientId) {
        MongoDBService.savePaymentData(clientId, serializedData).catch(err => {
          console.error('MongoDB sync failed:', err);
        });
      }
      
      return true;
    } catch (error) {
      console.error('Error saving payment data:', error);
      return false;
    }
  }

  private static async saveFile(namedFile: NamedFile, category: 'deposit-slip' | 'receipt' | 'other', paymentIndex?: number, paymentType?: 'regular' | 'first' | 'second' | 'third' | 'other', clientId?: string): Promise<string | null> {
    if (!namedFile || !('size' in namedFile)) {
      return namedFile?.id || null; // Return existing ID if it's already stored
    }
    
    try {
      // If it's a File object, save it using FileService
      const fileId = await FileService.saveFileAttachment(namedFile as File, category, clientId, paymentIndex, paymentType);
      return fileId;
    } catch (error) {
      console.error('Error saving file:', error);
      return null;
    }
  }

  private static getAllPaymentData(): Record<string, SerializedPaymentData> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return {};
      const parsed = JSON.parse(data);
      // Handle old format (single payment object) vs new format (keyed by clientId)
      if (parsed.paymentDetails) {
        return { default: parsed };
      }
      return parsed;
    } catch (error) {
      console.error('Error loading payment data:', error);
      return {};
    }
  }

  static getPaymentData(clientId?: string): SerializedPaymentData | null {
    try {
      const allPayments = this.getAllPaymentData();
      const key = clientId || 'default';
      return allPayments[key] || null;
    } catch (error) {
      console.error('Error loading payment data:', error);
      return null;
    }
  }

  // Get all file attachments for payment data
  static getPaymentFileAttachments(): Array<{ fileId: string; category: string; paymentInfo: string }> {
    const paymentData = this.loadPaymentData();
    if (!paymentData) return [];

    const fileAttachments: Array<{ fileId: string; category: string; paymentInfo: string }> = [];

    // Regular payment details
    paymentData.paymentDetails.forEach((detail, index) => {
      if (detail.depositSlip) {
        fileAttachments.push({
          fileId: detail.depositSlip,
          category: 'deposit-slip',
          paymentInfo: `Payment #${index + 1}`
        });
      }
      if (detail.receipt) {
        fileAttachments.push({
          fileId: detail.receipt,
          category: 'receipt',
          paymentInfo: `Payment #${index + 1}`
        });
      }
    });

    // Additional payments
    const additional = paymentData.additionalPayments;
    
    if (additional.firstPayment.depositSlip) {
      fileAttachments.push({
        fileId: additional.firstPayment.depositSlip,
        category: 'deposit-slip',
        paymentInfo: 'First Payment'
      });
    }
    if (additional.firstPayment.receipt) {
      fileAttachments.push({
        fileId: additional.firstPayment.receipt,
        category: 'receipt',
        paymentInfo: 'First Payment'
      });
    }

    if (additional.secondPayment.depositSlip) {
      fileAttachments.push({
        fileId: additional.secondPayment.depositSlip,
        category: 'deposit-slip',
        paymentInfo: 'Second Payment'
      });
    }
    if (additional.secondPayment.receipt) {
      fileAttachments.push({
        fileId: additional.secondPayment.receipt,
        category: 'receipt',
        paymentInfo: 'Second Payment'
      });
    }

    if (additional.thirdPayment.depositSlip) {
      fileAttachments.push({
        fileId: additional.thirdPayment.depositSlip,
        category: 'deposit-slip',
        paymentInfo: 'Third Payment'
      });
    }
    if (additional.thirdPayment.receipt) {
      fileAttachments.push({
        fileId: additional.thirdPayment.receipt,
        category: 'receipt',
        paymentInfo: 'Third Payment'
      });
    }

    if (additional.otherPayments.attachment) {
      fileAttachments.push({
        fileId: additional.otherPayments.attachment,
        category: 'other',
        paymentInfo: 'Other Payments'
      });
    }

    return fileAttachments;
  }
}