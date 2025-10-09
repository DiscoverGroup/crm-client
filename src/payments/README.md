# Payment Management System

This folder contains the payment management functionality for the CRM client application.

## Folder Structure

```
src/payments/
├── paymentService.ts      # Service for handling payment data operations
├── attachments/           # Storage folder for payment attachments
│   ├── deposit-slips/     # Folder for deposit slip files
│   └── receipts/          # Folder for receipt files
└── README.md             # This documentation file
```

## Features

### Payment Types Supported
- **Full Cash**: Single payment
- **Installment**: Up to 10 payment terms
- **Travel Funds**: Up to 10 payment terms  
- **Down Payment**: 2 payment terms

### File Upload Support
- **Deposit Slips**: PDF and image files
- **Receipts**: PDF and image files
- **Other Attachments**: PDF and image files

### Storage Organization
- Files are categorized into `deposit-slips` and `receipts` folders
- Each payment term can have both deposit slip and receipt attachments
- Additional payment dates (1st, 2nd, 3rd) can have separate attachments
- Other payments can have general attachments

## Usage

### Saving Payment Details
The `PaymentService.savePaymentData()` method handles:
1. Serializing payment data for storage
2. Simulating file uploads to the attachments folder
3. Storing payment metadata in localStorage (demo mode)

### File Management
In production, files would be:
1. Uploaded to a secure server storage
2. Associated with the client record
3. Accessible through proper authentication

### Data Structure
Payment data includes:
- Payment terms and counts
- Individual payment details with dates and files
- Additional payment schedules
- File metadata and references

## Development Notes

- Currently uses localStorage for demo purposes
- File uploads are simulated with console logging
- In production, integrate with proper file storage service
- Consider implementing file validation and size limits
- Add proper error handling for file upload failures