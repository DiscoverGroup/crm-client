import React, { useState, useEffect, useCallback } from 'react';
import { ClientService, type ClientData } from '../services/clientService';
import { PaymentService, type PaymentData } from "../payments/paymentService";
import type { PaymentDetail } from "../types/payment";
import { FileService, type FileAttachment } from '../services/fileService';
import { useFieldTracking } from '../hooks/useFieldTracking';
import { useSectionTracking } from '../hooks/useSectionTracking';
import FileAttachmentList from './FileAttachmentList';
import LogNoteComponent from './LogNoteComponent';
import Sidebar from "./Sidebar";
import UserProfile from './UserProfile';
import DeletedClients from './DeletedClients';
import ActivityLogViewer from './ActivityLogViewer';
import AdminPanel from './AdminPanel';
import { ActivityLogService } from '../services/activityLogService';
import R2DownloadButton from './R2DownloadButton';

// Utility for modern UI
const modernInput = {
  padding: "14px 16px",
  border: "2px solid rgba(147, 197, 253, 0.3)",
  borderRadius: "12px",
  fontSize: "16px",
  width: "100%",
  boxSizing: "border-box" as const,
  background: "rgba(255, 255, 255, 0.9)",
  transition: "all 0.3s ease",
  boxShadow: "0 2px 4px rgba(59, 130, 246, 0.1)"
};

// modernInputFocus removed because it was unused

const modernCheckbox = {
  width: "18px",
  height: "18px",
  accentColor: "#3b82f6",
  transform: "scale(1.2)",
  cursor: "pointer"
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  background: "rgba(255, 255, 255, 0.7)",
  borderRadius: "8px",
  border: "1px solid rgba(147, 197, 253, 0.2)",
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontWeight: 500,
  color: "#1e293b"
};
const sectionStyle = {
  background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)",
  padding: "32px",
  marginBottom: "32px",
  border: "1px solid rgba(147, 197, 253, 0.3)",
  position: "relative" as const,
  overflow: "hidden" as const
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  marginBottom: "24px",
  paddingBottom: "16px",
  borderBottom: "2px solid rgba(59, 130, 246, 0.1)"
};
const label = {
  fontWeight: 700,
  color: "#1e293b",
  marginBottom: "8px",
  display: "block",
  fontSize: "15px",
  letterSpacing: "0.025em"
};

const subLabel = {
  fontWeight: 500,
  color: "#64748b",
  fontSize: "13px",
  marginTop: "4px",
  fontStyle: "italic"
};

const saveButtonStyle = (isSaving: boolean) => ({
  background: isSaving 
    ? "linear-gradient(145deg, #9ca3af 0%, #6b7280 100%)"
    : "linear-gradient(145deg, #3b82f6 0%, #1d4ed8 100%)",
  color: "#fff",
  padding: "14px 32px",
  border: "none",
  borderRadius: "12px",
  fontSize: "16px",
  fontWeight: 600,
  cursor: isSaving ? "not-allowed" : "pointer",
  boxShadow: isSaving 
    ? "0 4px 12px rgba(156, 163, 175, 0.3)"
    : "0 8px 20px rgba(59, 130, 246, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)",
  transition: "all 0.3s ease",
  marginTop: "24px",
  position: "relative" as const,
  overflow: "hidden" as const,
  transform: isSaving ? "scale(0.98)" : "scale(1)"
});

const paymentOptions = [
  { value: "full_cash", label: "Full Cash (1 time payment)", terms: 1 },
  { value: "installment", label: "Installment (up to 10 terms)", terms: 10 },
  { value: "travel_funds", label: "Travel Funds (up to 10 terms)", terms: 10 },
  { value: "down_payment", label: "Down Payment (2 time payment)", terms: 2 }
];

// Companion type with extra fields
type Companion = {
  name: string;
  dob: string;
  address: string;
  occupation: string;
};

// Full featured ClientRecords form component
const ClientRecords: React.FC<{
  onClientSelect?: () => void;
  onNavigateBack?: () => void;
  clientId?: string;
  currentUser?: { fullName: string; username: string };
}> = ({ onNavigateBack, clientId, currentUser: propsCurrentUser }) => {
  // Client form state
  const [clientNo, setClientNo] = useState("");
  const [status, setStatus] = useState("Active");
  const [agent, setAgent] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [packageName, setPackageName] = useState("");
  const [travelDate, setTravelDate] = useState("");
  const [numberOfPax, setNumberOfPax] = useState<number>(1);
  const [bookingConfirmation, setBookingConfirmation] = useState("");
  
  // Generate temporary client ID for new clients
  const [tempClientId] = useState(() => clientId || `temp_${Date.now()}`);
  const [packageLink, setPackageLink] = useState("");
  
  // Log refresh state
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  
  // Field tracking setup
  const currentClientId = clientId || tempClientId;
  const currentUserId = "user_1"; // In a real app, get from auth context
  const currentUserName = propsCurrentUser?.fullName || "Current User"; // Use prop or fallback
  
  // Field tracking setup (kept for companion management only)
  const { logAction } = useFieldTracking({
    clientId: currentClientId,
    userId: currentUserId,
    userName: currentUserName,
    onLogAdded: () => setLogRefreshKey(prev => prev + 1)
  });

  // Section tracking setup
  const { trackSectionField, saveSection, logAttachment, logSectionAction } = useSectionTracking({
    clientId: currentClientId,
    userId: currentUserId,
    userName: currentUserName,
    onLogAdded: () => setLogRefreshKey(prev => prev + 1)
  });

  // Load existing client data if clientId is provided
  useEffect(() => {
    if (clientId) {
      const existingClient = ClientService.getClientById(clientId);
      if (existingClient) {
        setClientNo(existingClient.clientNo || '');
        setStatus(existingClient.status || 'Active');
        setAgent(existingClient.agent || '');
        setContactNo(existingClient.contactNo || '');
        setContactName(existingClient.contactName || '');
        setEmail(existingClient.email || '');
        setDateOfBirth(existingClient.dateOfBirth || '');
        setPackageName(existingClient.packageName || '');
        setTravelDate(existingClient.travelDate || '');
        setNumberOfPax(existingClient.numberOfPax || 1);
        setBookingConfirmation(existingClient.bookingConfirmation || '');
        setPackageLink(existingClient.packageLink || '');
        if (existingClient.companions) {
          setCompanions(existingClient.companions);
        }
      }
    }
  }, [clientId]);

  // Enhanced setters with section tracking
  const setClientNoTracked = (value: string) => {
    trackSectionField('client-information', 'clientNo', value, 'Client Number');
    setClientNo(value);
  };
  
  const setStatusTracked = (value: string) => {
    trackSectionField('client-information', 'status', value, 'Status');
    setStatus(value);
  };
  
  const setAgentTracked = (value: string) => {
    trackSectionField('client-information', 'agent', value, 'Agent');
    setAgent(value);
  };
  
  const setContactNoTracked = (value: string) => {
    trackSectionField('client-information', 'contactNo', value, 'Contact Number');
    setContactNo(value);
  };
  
  const setContactNameTracked = (value: string) => {
    trackSectionField('client-information', 'contactName', value, 'Contact Name');
    setContactName(value);
  };
  
  const setEmailTracked = (value: string) => {
    trackSectionField('client-information', 'email', value, 'Email');
    setEmail(value);
  };
  
  const setDateOfBirthTracked = (value: string) => {
    trackSectionField('client-information', 'dateOfBirth', value, 'Date of Birth');
    setDateOfBirth(value);
  };
  
  const setPackageNameTracked = (value: string) => {
    trackSectionField('package-information', 'packageName', value, 'Package Name');
    setPackageName(value);
  };
  
  const setTravelDateTracked = (value: string) => {
    trackSectionField('package-information', 'travelDate', value, 'Travel Date');
    setTravelDate(value);
  };
  
  const setNumberOfPaxTracked = (value: number) => {
    trackSectionField('package-information', 'numberOfPax', value, 'Number of Passengers');
    setNumberOfPax(value);
  };
  
  const setBookingConfirmationTracked = (value: string) => {
    trackSectionField('package-information', 'bookingConfirmation', value, 'Booking Confirmation');
    setBookingConfirmation(value);
  };

  // Payment state
  const [paymentTerm, setPaymentTerm] = useState(paymentOptions[0].value);
  const [termCount, setTermCount] = useState(1);
  const [selectedPaymentBox, setSelectedPaymentBox] = useState<number | null>(null);

  // Companions
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [newCompanion, setNewCompanion] = useState<Companion>({
    name: "",
    dob: "",
    address: "",
    occupation: ""
  });

  // Payment Details Table for terms
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>(
    Array.from({ length: termCount }, () => ({ date: "", depositSlip: null, receipt: null }))
  );

  // Additional payment states
  const [firstPaymentEnabled, setFirstPaymentEnabled] = useState(false);
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [firstPaymentDepositSlip, setFirstPaymentDepositSlip] = useState<File | null>(null);
  const [firstPaymentReceipt, setFirstPaymentReceipt] = useState<File | null>(null);
  
  const [secondPaymentDate] = useState("");
  const [secondPaymentDepositSlip] = useState<File | null>(null);
  const [secondPaymentReceipt] = useState<File | null>(null);
  
  const [thirdPaymentDate] = useState("");
  const [thirdPaymentDepositSlip] = useState<File | null>(null);
  const [thirdPaymentReceipt] = useState<File | null>(null);
  
  const [otherPaymentsEnabled, setOtherPaymentsEnabled] = useState(false);
  const [otherPaymentsDescription, setOtherPaymentsDescription] = useState("");
  const [otherPaymentsAttachment, setOtherPaymentsAttachment] = useState<File | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Visa section states
  const [visaService, setVisaService] = useState(false);
  const [insuranceService, setInsuranceService] = useState(false);
  const [eta, setEta] = useState(false);
  
  // Passport attachments (for up to 3 passports)
  const [passport1Name, setPassport1Name] = useState("");
  const [passport1Attachment, setPassport1Attachment] = useState<File | null>(null);
  const [passport1Visa, setPassport1Visa] = useState<File | null>(null);
  
  const [passport2Name, setPassport2Name] = useState("");
  const [passport2Attachment, setPassport2Attachment] = useState<File | null>(null);
  const [passport2Visa, setPassport2Visa] = useState<File | null>(null);
  
  const [passport3Name, setPassport3Name] = useState("");
  const [passport3Attachment, setPassport3Attachment] = useState<File | null>(null);
  const [passport3Visa, setPassport3Visa] = useState<File | null>(null);
  
  // Embassy information
  const [embassyAppointmentDate, setEmbassyAppointmentDate] = useState("");
  const [visaReleaseDate, setVisaReleaseDate] = useState("");
  const [visaResult, setVisaResult] = useState("");
  const [advisoryDate, setAdvisoryDate] = useState("");
  const [isSavingVisa, setIsSavingVisa] = useState(false);
  const [isSavingEmbassy, setIsSavingEmbassy] = useState(false);

  // Visa payment state
  type VisaPayment = {
    date: string;
    depositSlip: File | null;
    receipt: File | null;
  };
  const [visaPayments, setVisaPayments] = useState<VisaPayment[]>([
    { date: "", depositSlip: null, receipt: null }
  ]);

  // Insurance and ETA payment states
  const [insurancePayments, setInsurancePayments] = useState<VisaPayment[]>([
    { date: "", depositSlip: null, receipt: null }
  ]);
  const [etaPayments, setEtaPayments] = useState<VisaPayment[]>([
    { date: "", depositSlip: null, receipt: null }
  ]);

  // Booking/Voucher section states
  const [intlFlight, setIntlFlight] = useState<File | null>(null);
  const [localFlight1, setLocalFlight1] = useState<File | null>(null);
  const [localFlight2, setLocalFlight2] = useState<File | null>(null);
  const [localFlight3, setLocalFlight3] = useState<File | null>(null);
  const [localFlight4, setLocalFlight4] = useState<File | null>(null);
  const [hotelVoucher, setHotelVoucher] = useState<File | null>(null);
  const [otherFiles, setOtherFiles] = useState<File | null>(null);

  // Important Notes/Requests section states
  type RequestNote = {
    department: string;
    request: string;
    date: string;
    agent: string;
  };
  const [requestNotes, setRequestNotes] = useState<RequestNote[]>([
    { department: "", request: "", date: "", agent: "" }
  ]);

  // File attachment state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // PaymentTerm-driven behavior
  const currentOption = paymentOptions.find(opt => opt.value === paymentTerm)!;
  const showTermCount = paymentTerm === "installment" || paymentTerm === "travel_funds";
  const paymentBoxes = Array.from({ length: currentOption.value === "installment" || currentOption.value === "travel_funds" ? termCount : currentOption.terms }, (_, i) => i + 1);

  // Sync paymentDetails rows with termCount
  useEffect(() => {
    setPaymentDetails(prev => {
      const next = [...prev];
      if (next.length < termCount) {
        for (let i = next.length; i < termCount; i++) next.push({ date: "", depositSlip: null, receipt: null });
      } else if (next.length > termCount) {
        next.length = termCount;
      }
      return next;
    });
  }, [termCount]);

  // Load file attachments
  useEffect(() => {
    const loadAttachments = () => {
      try {
        const currentClientId = clientId || tempClientId;
        if (currentClientId) {
          // Load attachments for specific client (real or temp)
          const clientAttachments = FileService.getFilesByClient(currentClientId);
          setAttachments(clientAttachments);
        } else {
          // Fallback to empty
          setAttachments([]);
        }
      } catch (error) {
        console.error('Error loading attachments:', error);
      }
    };
    
    loadAttachments();
    
    // Listen for file updates
    window.addEventListener('fileAttachmentUpdated', loadAttachments);
    return () => window.removeEventListener('fileAttachmentUpdated', loadAttachments);
  }, [clientId, tempClientId]);

  const handlePaymentDetailChange = async (
    idx: number,
    field: "date" | "depositSlip" | "receipt",
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === "date") {
      setPaymentDetails(pd =>
        pd.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, date: value as string };
        })
      );
      return;
    }

    const event = value as React.ChangeEvent<HTMLInputElement>;
    const file = event?.target?.files?.[0];
    
    if (file) {
      try {
        // Save file to FileService with client ID (real or temporary)
        const currentClientId = clientId || tempClientId;
        const category = field === "depositSlip" ? "deposit-slip" : "receipt";
        await FileService.saveFileAttachment(file, category, currentClientId, idx, "regular", "payment-terms", currentUserName);
        
        // Log the file attachment
        logAttachment(
          'payment-terms-schedule',
          'uploaded',
          file.name,
          field === "depositSlip" ? "deposit slip" : "receipt"
        );
        
        // Update local state
        setPaymentDetails(pd =>
          pd.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: file };
          })
        );
        
        // Refresh attachments
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        setAttachments(clientAttachments);
        
        // Trigger file update event
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file. Please try again.');
      }
    } else {
      // Clear file
      setPaymentDetails(pd =>
        pd.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, [field]: null };
        })
      );
    }
  };

  const handleRemovePaymentAttachment = async (
    fileId: string,
    idx: number,
    field: "depositSlip" | "receipt"
  ) => {
    if (!window.confirm('Are you sure you want to remove this file?')) {
      return;
    }

    try {
      console.log('🗑️ Removing file:', fileId);
      
      // Delete file from FileService
      const success = await FileService.deleteFile(fileId, currentUserName);
      
      console.log('Delete result:', success);
      
      if (success) {
        // Clear from local state
        setPaymentDetails(pd =>
          pd.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: null };
          })
        );
        
        // Refresh attachments immediately with a new array reference to force re-render
        const currentClientId = clientId || tempClientId;
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        console.log('Refreshed attachments after deletion:', clientAttachments.length);
        setAttachments([...clientAttachments]); // Create new array to ensure state update
        
        // Clear the file input element
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
          const inputElement = input as HTMLInputElement;
          inputElement.value = '';
        });
        
        // Log the removal
        logAttachment(
          'payment-terms-schedule',
          'deleted',
          'File removed',
          field === "depositSlip" ? "deposit slip" : "receipt"
        );
        
        // Trigger file update event
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
        
        console.log('✅ File removed successfully');
      } else {
        alert('Failed to remove file. Please try again.');
      }
    } catch (error) {
      console.error('❌ Error removing file:', error);
      alert('Failed to remove file. Please try again.');
    }
  };

  const handleSavePaymentDetails = async () => {
    setIsSaving(true);
    try {
      const paymentData: PaymentData = {
        paymentTerm,
        termCount,
        selectedPaymentBox,
        paymentDetails,
        additionalPayments: {
          firstPayment: {
            enabled: firstPaymentEnabled,
            date: firstPaymentDate,
            depositSlip: firstPaymentDepositSlip,
            receipt: firstPaymentReceipt,
          },
          secondPayment: {
            date: secondPaymentDate,
            depositSlip: secondPaymentDepositSlip,
            receipt: secondPaymentReceipt,
          },
          thirdPayment: {
            date: thirdPaymentDate,
            depositSlip: thirdPaymentDepositSlip,
            receipt: thirdPaymentReceipt,
          },
          otherPayments: {
            enabled: otherPaymentsEnabled,
            description: otherPaymentsDescription,
            attachment: otherPaymentsAttachment,
          },
        },
      };

      const success = await PaymentService.savePaymentData(paymentData, clientId || currentClientId);
      if (success) {
        // Save section changes to log
        saveSection('payment-terms-schedule', 'Payment Terms & Schedule');
        alert('Payment details saved successfully!');
      } else {
        logSectionAction(
          'payment-terms-schedule',
          'Save Failed',
          'Failed to save payment details',
          'pending'
        );
        alert('Failed to save payment details. Please try again.');
      }
    } catch (error) {
      console.error('Error saving payment details:', error);
      logSectionAction(
        'payment-terms-schedule',
        'Save Error',
        'An error occurred while saving payment details',
        'pending'
      );
      alert('An error occurred while saving payment details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClientInfo = async () => {
    setIsSavingClient(true);
    try {
      const generatedClientNo = clientNo || `CLT-${Date.now()}`;
      const clientData = {
        clientNo: generatedClientNo,
        status,
        agent,
        contactNo,
        contactName,
        email,
        dateOfBirth,
        packageName,
        travelDate,
        numberOfPax,
        bookingConfirmation,
        packageLink,
        companions: companions
      };

      // Save client and check if it's new or updated
      const { clientId: savedClientId, isNewClient } = await ClientService.saveClient(clientData);
      
      // Log activity
      if (isNewClient) {
        ActivityLogService.addLog({
          clientId: savedClientId,
          clientName: contactName || 'Unknown',
          action: 'created',
          performedBy: currentUserName,
          performedByUser: currentUserName,
          details: `New client created`
        });
      } else {
        ActivityLogService.addLog({
          clientId: savedClientId,
          clientName: contactName || 'Unknown',
          action: 'edited',
          performedBy: currentUserName,
          performedByUser: currentUserName,
          details: `Client information updated`
        });
      }
      
      // Save section changes to log
      saveSection('client-information', 'Client Information');
      
      // If this is a new client (no existing clientId), update file associations
      if (!clientId && tempClientId !== generatedClientNo) {
        FileService.updateClientIdForTempFiles(tempClientId, generatedClientNo);
        // Refresh attachments with new client ID
        const clientAttachments = FileService.getFilesByClient(generatedClientNo);
        setAttachments(clientAttachments);
      }
      
      alert('Client information saved successfully!');
      
      // Trigger client list refresh
      window.dispatchEvent(new Event('clientDataUpdated'));
      
      // Navigate back to client list after saving
      if (onNavigateBack) {
        setTimeout(() => onNavigateBack(), 500);
      }
    } catch (error) {
      console.error('Error saving client info:', error);
      logSectionAction(
        'client-information',
        'Save Failed',
        'Failed to save client information',
        'pending'
      );
      alert('An error occurred while saving client information.');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleSavePackageInfo = async () => {
    setIsSavingPackage(true);
    try {
      // Ensure we have a clientNo (required for saving)
      if (!clientNo) {
        alert('Please save client information first before saving package details.');
        return;
      }

      // Ensure we have a clientId
      if (!clientId) {
        alert('Client ID not found. Please save client information first.');
        return;
      }

      // Get the existing client data
      const existingClient = ClientService.getClientById(clientId);
      if (!existingClient) {
        alert('Client not found. Please save client information first.');
        return;
      }

      // Update client with package information
      const clientData = {
        ...existingClient,
        packageName,
        travelDate,
        numberOfPax,
        bookingConfirmation,
        packageLink,
        companions: companions
      };

      // Save to ClientService
      await ClientService.saveClient(clientData);

      // Log activity
      ActivityLogService.addLog({
        clientId: clientId || currentClientId,
        clientName: contactName || 'Unknown',
        action: 'edited',
        performedBy: currentUserName,
        performedByUser: currentUserName,
        details: `Package & travel information updated`
      });
      
      // Save section changes to log
      saveSection('package-information', 'Package & Companions');
      
      alert('Package & companions information saved successfully!');
      
      // Trigger client list refresh
      window.dispatchEvent(new Event('clientDataUpdated'));
    } catch (error) {
      console.error('Error saving package info:', error);
      logSectionAction(
        'package-information',
        'Save Failed',
        'Failed to save package information',
        'pending'
      );
      alert('An error occurred while saving package information.');
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleSaveVisaInfo = async () => {
    setIsSavingVisa(true);
    try {
      // Simulate saving visa information
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Visa information saved successfully!');
    } catch (error) {
      console.error('Error saving visa info:', error);
      alert('An error occurred while saving visa information.');
    } finally {
      setIsSavingVisa(false);
    }
  };

  const handleSaveEmbassyInfo = async () => {
    setIsSavingEmbassy(true);
    try {
      // Simulate saving embassy information
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Save section changes to log
      saveSection('embassy-information', 'Embassy Information');
      
      alert('Embassy information saved successfully!');
    } catch (error) {
      console.error('Error saving embassy info:', error);
      logSectionAction(
        'embassy-information',
        'Save Failed',
        'Failed to save embassy information',
        'pending'
      );
      alert('An error occurred while saving embassy information.');
    } finally {
      setIsSavingEmbassy(false);
    }
  };

  // Visa payment handlers
  const handleVisaPaymentChange = async (
    idx: number,
    field: "date" | "depositSlip" | "receipt",
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === "date") {
      setVisaPayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, date: value as string };
        })
      );
      return;
    }

    const event = value as React.ChangeEvent<HTMLInputElement>;
    const file = event?.target?.files?.[0];
    
    if (file) {
      try {
        // Save file to FileService with client ID for visa payments
        const currentClientId = clientId || tempClientId;
        const category = field === "depositSlip" ? "deposit-slip" : "receipt";
        await FileService.saveFileAttachment(file, category, currentClientId, idx, "other", "visa-service", currentUserName);
        
        // Log the file attachment
        logAttachment(
          'visa-service',
          'uploaded',
          file.name,
          field === "depositSlip" ? "visa deposit slip" : "visa receipt"
        );
        
        // Update local state
        setVisaPayments(prev =>
          prev.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: file };
          })
        );
        
        // Refresh attachments
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        setAttachments(clientAttachments);
        
        // Trigger file update event
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
      } catch (error) {
        console.error('Error uploading visa payment file:', error);
        alert('Failed to upload file. Please try again.');
      }
    } else {
      // Clear file
      setVisaPayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, [field]: null };
        })
      );
    }
  };

  const handleAddVisaPayment = () => {
    setVisaPayments(prev => [...prev, { date: "", depositSlip: null, receipt: null }]);
  };

  const handleRemoveVisaPayment = (idx: number) => {
    if (visaPayments.length > 1) {
      setVisaPayments(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Insurance payment handlers
  const handleInsurancePaymentChange = async (
    idx: number,
    field: "date" | "depositSlip" | "receipt",
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === "date") {
      setInsurancePayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, date: value as string };
        })
      );
      return;
    }

    const event = value as React.ChangeEvent<HTMLInputElement>;
    const file = event?.target?.files?.[0];
    
    if (file) {
      try {
        const currentClientId = clientId || tempClientId;
        const category = field === "depositSlip" ? "deposit-slip" : "receipt";
        await FileService.saveFileAttachment(file, category, currentClientId, idx, "other", "insurance-service", currentUserName);
        
        // Log the file attachment
        logAttachment(
          'insurance-service',
          'uploaded',
          file.name,
          field === "depositSlip" ? "insurance deposit slip" : "insurance receipt"
        );
        
        setInsurancePayments(prev =>
          prev.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: file };
          })
        );
        
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        setAttachments(clientAttachments);
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
      } catch (error) {
        console.error('Error uploading insurance payment file:', error);
        alert('Failed to upload file. Please try again.');
      }
    } else {
      setInsurancePayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, [field]: null };
        })
      );
    }
  };

  const handleAddInsurancePayment = () => {
    setInsurancePayments(prev => [...prev, { date: "", depositSlip: null, receipt: null }]);
  };

  const handleRemoveInsurancePayment = (idx: number) => {
    if (insurancePayments.length > 1) {
      setInsurancePayments(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // ETA payment handlers
  const handleEtaPaymentChange = async (
    idx: number,
    field: "date" | "depositSlip" | "receipt",
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === "date") {
      setEtaPayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, date: value as string };
        })
      );
      return;
    }

    const event = value as React.ChangeEvent<HTMLInputElement>;
    const file = event?.target?.files?.[0];
    
    if (file) {
      try {
        const currentClientId = clientId || tempClientId;
        const category = field === "depositSlip" ? "deposit-slip" : "receipt";
        await FileService.saveFileAttachment(file, category, currentClientId, idx, "other", "eta-service", currentUserName);
        
        // Log the file attachment
        logAttachment(
          'eta-service',
          'uploaded',
          file.name,
          field === "depositSlip" ? "ETA deposit slip" : "ETA receipt"
        );
        
        setEtaPayments(prev =>
          prev.map((row, i) => {
            if (i !== idx) return row;
            return { ...row, [field]: file };
          })
        );
        
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        setAttachments(clientAttachments);
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
      } catch (error) {
        console.error('Error uploading ETA payment file:', error);
        alert('Failed to upload file. Please try again.');
      }
    } else {
      setEtaPayments(prev =>
        prev.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, [field]: null };
        })
      );
    }
  };

  const handleAddEtaPayment = () => {
    setEtaPayments(prev => [...prev, { date: "", depositSlip: null, receipt: null }]);
  };

  const handleRemoveEtaPayment = (idx: number) => {
    if (etaPayments.length > 1) {
      setEtaPayments(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Request Notes handlers
  const handleRequestNoteChange = (idx: number, field: keyof RequestNote, value: string) => {
    setRequestNotes(prev => 
      prev.map((note, i) => 
        i === idx ? { ...note, [field]: value } : note
      )
    );
  };

  const handleAddRequestNote = () => {
    setRequestNotes(prev => [...prev, { department: "", request: "", date: "", agent: "" }]);
  };

  const handleRemoveRequestNote = (idx: number) => {
    if (requestNotes.length > 1) {
      setRequestNotes(prev => prev.filter((_, i) => i !== idx));
    }
  };

  // Handlers
  function handleCompanionFieldChange(field: keyof Companion, value: string) {
    setNewCompanion({ ...newCompanion, [field]: value });
  }

  function handleAddCompanion() {
    if (newCompanion.name.trim()) {
      setCompanions([...companions, newCompanion]);
      logAction(
        'Companion Added',
        `Added companion: ${newCompanion.name}`,
        'done'
      );
      setNewCompanion({ name: "", dob: "", address: "", occupation: "" });
    }
  }

  function handleRemoveCompanion(idx: number) {
    const removedCompanion = companions[idx];
    setCompanions(companions.filter((_, i) => i !== idx));
    logAction(
      'Companion Removed',
      `Removed companion: ${removedCompanion.name}`,
      'done'
    );
  }

  function handlePaymentTermChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    trackSectionField('payment-terms-schedule', 'paymentTerm', selected, 'Payment Terms');
    setPaymentTerm(selected);
    const opt = paymentOptions.find(o => o.value === selected)!;
    if (selected === "installment" || selected === "travel_funds") {
      setTermCount(2); // default for these types
      trackSectionField('payment-terms-schedule', 'termCount', 2, 'Number of Terms');
    } else {
      setTermCount(opt.terms);
      trackSectionField('payment-terms-schedule', 'termCount', opt.terms, 'Number of Terms');
    }
    setSelectedPaymentBox(null);
  }

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: "linear-gradient(135deg, #e1f4fd 0%, #cde9fb 50%, #b8ddf9 100%)"
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "40px auto",
        padding: "0 20px",
        display: 'flex',
        gap: '24px',
        alignItems: 'flex-start'
      }}>
        {/* Main Content - Left Side */}
        <div style={{
          flex: 1,
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: 16,
          boxShadow: "0 4px 32px 0 rgba(59, 130, 246, 0.15)",
          backdropFilter: "blur(10px)"
        }}>
          <form style={{ padding: 24 }} autoComplete="off">
          {/* Header */}
          <div style={{ 
            background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)", 
            borderRadius: "16px", 
            padding: "32px", 
            marginBottom: "32px",
            boxShadow: "0 8px 32px rgba(59, 130, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)",
            border: "1px solid rgba(147, 197, 253, 0.3)",
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative' as const,
            overflow: 'hidden' as const
          }}>
            {/* Decorative background element */}
            <div style={{
              position: 'absolute',
              top: '-50%',
              right: '-20%',
              width: '200px',
              height: '200px',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.05) 100%)',
              borderRadius: '50%',
              zIndex: 0
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '28px', marginRight: '12px' }}>👤</span>
                <h1 style={{ 
                  margin: 0, 
                  color: "#1e293b", 
                  fontSize: "28px", 
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.025em"
                }}>
                  New Client Registration
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateBack}
              style={{
                padding: '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.3s ease'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
            >
              ← Back to Dashboard
            </button>
          </div>
          
          {/* Client Info */}
          <div style={sectionStyle}>
            {/* Section Header */}
            <div style={sectionHeader}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📋</span>
              <h2 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "20px", 
                fontWeight: 700,
                letterSpacing: "-0.025em"
              }}>
                Client Information
              </h2>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Client No</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Auto-generated or enter client number"
                  value={clientNo}
                  onChange={e => setClientNoTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Status</label>
                <select 
                  style={modernInput}
                  value={status}
                  onChange={e => setStatusTracked(e.target.value)}
                >
                  <option>Active</option>
                  <option>Float</option>
                  <option>Refund</option>
                  <option>Travel Funds</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Agent</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Agent name"
                  value={agent}
                  onChange={e => setAgentTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Contact No</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Contact number"
                  value={contactNo}
                  onChange={e => setContactNoTracked(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Contact Name</label>
                <input 
                  style={{ ...modernInput, fontWeight: "bold" }} 
                  type="text" 
                  placeholder="Full name"
                  value={contactName}
                  onChange={e => setContactNameTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Email</label>
                <input 
                  style={modernInput} 
                  type="email" 
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmailTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Date of Birth</label>
                <input 
                  style={modernInput} 
                  type="date"
                  value={dateOfBirth}
                  onChange={e => setDateOfBirthTracked(e.target.value)}
                />
              </div>
            </div>
            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: '12px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '500' }}>
                ⚠️ Remember to save changes before leaving!
              </span>
              <button
                type="button"
                onClick={handleSaveClientInfo}
                disabled={isSavingClient}
                style={saveButtonStyle(isSavingClient)}
              >
                {isSavingClient ? "Saving..." : "💾 Save Client Info"}
              </button>
            </div>
          </div>

          {/* Package & Companions */}
          <div style={sectionStyle}>
            {/* Section Header */}
            <div style={sectionHeader}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🎒</span>
              <h2 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "20px", 
                fontWeight: 700,
                letterSpacing: "-0.025em"
              }}>
                Package & Travel Details
              </h2>
            </div>
            <div style={{ display: "flex", gap: 32 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Package</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Package name"
                  value={packageName}
                  onChange={e => setPackageNameTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Travel Date</label>
                <input 
                  style={modernInput} 
                  type="date"
                  value={travelDate}
                  onChange={e => setTravelDateTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>No. of Pax</label>
                <input 
                  style={modernInput} 
                  type="number" 
                  min={1}
                  value={numberOfPax}
                  onChange={e => setNumberOfPaxTracked(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 32, marginTop: 18 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Booking Confirmation</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Booking reference"
                  value={bookingConfirmation}
                  onChange={e => setBookingConfirmationTracked(e.target.value)}
                />
              </div>
              <div style={{ flex: 2 }}>
                <label style={label}>Package Link</label>
                <input 
                  style={modernInput} 
                  type="url" 
                  placeholder="URL"
                  value={packageLink}
                  onChange={e => setPackageLink(e.target.value)}
                />
              </div>
            </div>
            
            {/* Companions Section */}
            <div style={{ marginTop: 18 }}>
              <label style={label}>Companions</label>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                {companions.map((comp, idx) => (
                  <div key={idx} style={{
                    background: "#eef2ff",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 10,
                    minWidth: 300,
                    position: "relative"
                  }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveCompanion(idx)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: 8,
                        background: "none",
                        border: "none",
                        color: "#6366f1",
                        cursor: "pointer",
                        fontWeight: "bold",
                        fontSize: 17,
                      }}>×</button>
                    <div>
                      <label style={label}>Name</label>
                      <input
                        style={modernInput}
                        type="text"
                        value={comp.name}
                        readOnly
                      />
                    </div>
                    <div>
                      <label style={label}>Date of Birth</label>
                      <input
                        style={modernInput}
                        type="date"
                        value={comp.dob}
                        readOnly
                      />
                    </div>
                    <div>
                      <label style={label}>Address</label>
                      <input
                        style={modernInput}
                        type="text"
                        value={comp.address}
                        readOnly
                      />
                    </div>
                    <div>
                      <label style={label}>Occupation</label>
                      <input
                        style={modernInput}
                        type="text"
                        value={comp.occupation}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Add new companion form */}
              <div style={{
                background: "#fff",
                borderRadius: 10,
                padding: 16,
                minWidth: 300,
                boxShadow: "0 1px 3px #e0e7ff"
              }}>
                <div>
                  <label style={label}>Name</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Companion name"
                    value={newCompanion.name}
                    onChange={e => handleCompanionFieldChange("name", e.target.value)}
                  />
                </div>
                <div>
                  <label style={label}>Date of Birth</label>
                  <input
                    style={modernInput}
                    type="date"
                    value={newCompanion.dob}
                    onChange={e => handleCompanionFieldChange("dob", e.target.value)}
                  />
                </div>
                <div>
                  <label style={label}>Address</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Address"
                    value={newCompanion.address}
                    onChange={e => handleCompanionFieldChange("address", e.target.value)}
                  />
                </div>
                <div>
                  <label style={label}>Occupation</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Occupation"
                    value={newCompanion.occupation}
                    onChange={e => handleCompanionFieldChange("occupation", e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  style={{
                    marginTop: 10,
                    background: "#2563eb",
                    color: "#fff",
                    padding: "7px 18px",
                    border: "none",
                    borderRadius: "6px",
                    fontSize: 16,
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                  onClick={handleAddCompanion}
                  disabled={!newCompanion.name.trim()}
                >
                  Add Companion
                </button>
              </div>
            </div>
            
            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSavePackageInfo}
                disabled={isSavingPackage}
                style={saveButtonStyle(isSavingPackage)}
              >
                {isSavingPackage ? "Saving..." : "Save Package & Companions"}
              </button>
            </div>
          </div>

          {/* Payment Terms & Schedule */}
          <div style={sectionStyle}>
            {/* Section Header */}
            <div style={sectionHeader}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>💳</span>
              <h2 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "20px", 
                fontWeight: 700,
                letterSpacing: "-0.025em"
              }}>
                Payment Terms & Schedule
              </h2>
            </div>
            
            <div style={{ display: "flex", alignItems: "flex-end", gap: 32, marginBottom: 24 }}>
              <div style={{ flex: 2 }}>
                <label style={label}>Payment Terms</label>
                <select style={modernInput} value={paymentTerm} onChange={handlePaymentTermChange}>
                  {paymentOptions.map(opt =>
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  )}
                </select>
              </div>
              {showTermCount && (
                <div style={{ flex: 1 }}>
                  <label style={label}>Terms</label>
                  <input
                    style={modernInput}
                    type="number"
                    min={1}
                    max={currentOption.terms}
                    value={termCount}
                    onChange={e => {
                      let v = parseInt(e.target.value);
                      if (isNaN(v)) v = 1;
                      if (v < 1) v = 1;
                      if (v > currentOption.terms) v = currentOption.terms;
                      setTermCount(v);
                      setSelectedPaymentBox(null);
                    }}
                  />
                  <span style={subLabel}>(1 to {currentOption.terms} terms allowed)</span>
                </div>
              )}
              <div style={{ flex: 2 }}>
                <label style={label}>Payment Counts</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {paymentBoxes.map(num => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setSelectedPaymentBox(num)}
                      style={{
                        width: 34, height: 34,
                        fontSize: 15,
                        marginRight: 3,
                        border: "1.5px solid #6366f1",
                        borderRadius: 8,
                        background: selectedPaymentBox === num ? "#6366f1" : "#fff",
                        color: selectedPaymentBox === num ? "#fff" : "#222",
                        cursor: "pointer",
                        fontWeight: 600,
                        transition: "background .13s"
                      }}>
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Payment Details Table */}
            {paymentBoxes.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "12px", borderBottom: "2px solid #e2e8f0" }}>Payment #</th>
                      <th style={{ textAlign: "left", padding: "12px", borderBottom: "2px solid #e2e8f0" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "12px", borderBottom: "2px solid #e2e8f0" }}>Deposit Slip</th>
                      <th style={{ textAlign: "left", padding: "12px", borderBottom: "2px solid #e2e8f0" }}>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentDetails.slice(0, paymentBoxes.length).map((detail, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                          Payment {idx + 1}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                          <input
                            type="date"
                            value={detail.date}
                            onChange={e => handlePaymentDetailChange(idx, "date", e.target.value)}
                            style={{ ...modernInput, margin: 0 }}
                          />
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => handlePaymentDetailChange(idx, "depositSlip", e)}
                            style={{ fontSize: "14px" }}
                          />
                          {(() => {
                            const uploadedFile = attachments.find(att => 
                              att.category === 'deposit-slip' && 
                              att.paymentIndex === idx && 
                              att.source === 'payment-terms'
                            );
                            if (uploadedFile) {
                              return (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: "12px", color: "#059669" }}>
                                    ✓ {uploadedFile.file.name}
                                  </span>
                                  <R2DownloadButton
                                    url={uploadedFile.file.data}
                                    fileName={uploadedFile.file.name}
                                    r2Path={uploadedFile.file.r2Path}
                                    bucket="crm-uploads"
                                  />
                                  <button
                                    onClick={() => handleRemovePaymentAttachment(uploadedFile.file.id, idx, "depositSlip")}
                                    style={{
                                      fontSize: "14px",
                                      color: "#ef4444",
                                      background: "transparent",
                                      border: "1px solid #ef4444",
                                      borderRadius: "4px",
                                      padding: "2px 6px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}
                                    title="Remove file"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td style={{ padding: "12px", borderBottom: "1px solid #e2e8f0" }}>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={e => handlePaymentDetailChange(idx, "receipt", e)}
                            style={{ fontSize: "14px" }}
                          />
                          {(() => {
                            const uploadedFile = attachments.find(att => 
                              att.category === 'receipt' && 
                              att.paymentIndex === idx && 
                              att.source === 'payment-terms'
                            );
                            if (uploadedFile) {
                              return (
                                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: "12px", color: "#059669" }}>
                                    ✓ {uploadedFile.file.name}
                                  </span>
                                  <R2DownloadButton
                                    url={uploadedFile.file.data}
                                    fileName={uploadedFile.file.name}
                                    r2Path={uploadedFile.file.r2Path}
                                    bucket="crm-uploads"
                                  />
                                  <button
                                    onClick={() => handleRemovePaymentAttachment(uploadedFile.file.id, idx, "receipt")}
                                    style={{
                                      fontSize: "14px",
                                      color: "#ef4444",
                                      background: "transparent",
                                      border: "1px solid #ef4444",
                                      borderRadius: "4px",
                                      padding: "2px 6px",
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center"
                                    }}
                                    title="Remove file"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Additional Payment Sections */}
            <div style={{ marginTop: 20 }}>
              {/* First Payment */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={firstPaymentEnabled}
                    onChange={e => setFirstPaymentEnabled(e.target.checked)}
                  />
                  <span style={label}>First Payment</span>
                </label>
                {firstPaymentEnabled && (
                  <div style={{ display: "flex", gap: 16, marginLeft: 24 }}>
                    <input
                      type="date"
                      value={firstPaymentDate}
                      onChange={e => setFirstPaymentDate(e.target.value)}
                      style={modernInput}
                      placeholder="Date"
                    />
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setFirstPaymentDepositSlip(e.target.files?.[0] || null)}
                      style={{ fontSize: "14px" }}
                    />
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setFirstPaymentReceipt(e.target.files?.[0] || null)}
                      style={{ fontSize: "14px" }}
                    />
                  </div>
                )}
              </div>

              {/* Other Payments */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={otherPaymentsEnabled}
                    onChange={e => setOtherPaymentsEnabled(e.target.checked)}
                  />
                  <span style={label}>Other Payments</span>
                </label>
                {otherPaymentsEnabled && (
                  <div style={{ display: "flex", gap: 16, marginLeft: 24 }}>
                    <input
                      type="text"
                      value={otherPaymentsDescription}
                      onChange={e => setOtherPaymentsDescription(e.target.value)}
                      style={modernInput}
                      placeholder="Description"
                    />
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={e => setOtherPaymentsAttachment(e.target.files?.[0] || null)}
                      style={{ fontSize: "14px" }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSavePaymentDetails}
                disabled={isSaving}
                style={saveButtonStyle(isSaving)}
              >
                {isSaving ? "Saving..." : "Save Payment Details"}
              </button>
            </div>
          </div>

          {/* Visa Section */}
          <div style={sectionStyle}>
            {/* Section Header */}
            <div style={sectionHeader}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🛂</span>
              <h2 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "20px", 
                fontWeight: 700,
                letterSpacing: "-0.025em"
              }}>
                Visa & Additional Services
              </h2>
            </div>
            
            {/* Visa Service Options */}
            <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={visaService}
                  onChange={e => setVisaService(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>🛂 Visa Service</span>
              </label>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={insuranceService}
                  onChange={e => setInsuranceService(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>🛡️ Insurance Service</span>
              </label>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={eta}
                  onChange={e => setEta(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>✈️ ETA</span>
              </label>
            </div>

            {/* Visa Service Payment Form (shown when Visa Service is checked) */}
            {visaService && (
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
                  Visa Service Payments
                </h4>
                
                {visaPayments.map((payment, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 16, 
                    padding: 16, 
                    backgroundColor: "#f8f9fa", 
                    borderRadius: 8,
                    border: "1px solid #e9ecef"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h5 style={{ margin: 0, color: "#333", fontSize: "14px", fontWeight: "600" }}>
                        Visa Payment {idx + 1}
                      </h5>
                      {visaPayments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVisaPayment(idx)}
                          style={{
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Payment Date</label>
                        <input
                          style={modernInput}
                          type="date"
                          value={payment.date}
                          onChange={e => handleVisaPaymentChange(idx, "date", e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Deposit Slip</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleVisaPaymentChange(idx, "depositSlip", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.depositSlip && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.depositSlip.name}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleVisaPaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.receipt && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.receipt.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={handleAddVisaPayment}
                  style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  Add Visa Payment
                </button>
              </div>
            )}

            {/* Booking/Tour Voucher Section */}
            <div style={{
              ...sectionStyle,
              marginTop: "24px",
              background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)",
              border: "2px solid rgba(147, 197, 253, 0.3)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)"
            }}>
              {/* Section Header */}
              <div style={sectionHeader}>
                <span style={{ fontSize: '24px', marginRight: '12px' }}>🎫</span>
                <h2 style={{ 
                  margin: 0, 
                  color: "#1e293b", 
                  fontSize: "20px", 
                  fontWeight: 700,
                  letterSpacing: "-0.025em"
                }}>
                  Booking/Tour Voucher
                </h2>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginTop: "16px" }}>
                {/* International Flight */}
                <div>
                  <label style={label}>✈️ International Flight</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setIntlFlight(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {intlFlight && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {intlFlight.name}
                    </div>
                  )}
                </div>

                {/* Local Flight 1 */}
                <div>
                  <label style={label}>🛩️ Local Flight 1</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLocalFlight1(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {localFlight1 && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {localFlight1.name}
                    </div>
                  )}
                </div>

                {/* Local Flight 2 */}
                <div>
                  <label style={label}>🛩️ Local Flight 2</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLocalFlight2(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {localFlight2 && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {localFlight2.name}
                    </div>
                  )}
                </div>

                {/* Local Flight 3 */}
                <div>
                  <label style={label}>🛩️ Local Flight 3</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLocalFlight3(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {localFlight3 && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {localFlight3.name}
                    </div>
                  )}
                </div>

                {/* Local Flight 4 */}
                <div>
                  <label style={label}>🛩️ Local Flight 4</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setLocalFlight4(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {localFlight4 && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {localFlight4.name}
                    </div>
                  )}
                </div>

                {/* Hotel Voucher */}
                <div>
                  <label style={label}>🏨 Hotel Voucher</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setHotelVoucher(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {hotelVoucher && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {hotelVoucher.name}
                    </div>
                  )}
                </div>

                {/* Other Files */}
                <div>
                  <label style={label}>📄 Other Files</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setOtherFiles(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {otherFiles && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {otherFiles.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Important Notes/Requests Section */}
            <div style={{
              ...sectionStyle,
              marginTop: "24px",
              background: "linear-gradient(145deg, rgba(255, 248, 220, 0.95) 0%, rgba(254, 249, 195, 0.9) 100%)",
              border: "2px solid rgba(251, 191, 36, 0.3)",
              borderRadius: "16px",
              padding: "24px",
              boxShadow: "0 8px 32px rgba(251, 191, 36, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)"
            }}>
              {/* Section Header */}
              <div style={sectionHeader}>
                <span style={{ fontSize: '24px', marginRight: '12px' }}>📝</span>
                <h2 style={{ 
                  margin: 0, 
                  color: "#92400e", 
                  fontSize: "20px", 
                  fontWeight: 700,
                  letterSpacing: "-0.025em"
                }}>
                  Important Notes/Requests
                </h2>
              </div>

              <div style={{ marginTop: "16px" }}>
                {requestNotes.map((note, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 16, 
                    padding: 16, 
                    backgroundColor: "rgba(255, 255, 255, 0.8)", 
                    borderRadius: 12,
                    border: "1px solid rgba(251, 191, 36, 0.2)",
                    boxShadow: "0 2px 8px rgba(251, 191, 36, 0.1)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h5 style={{ margin: 0, color: "#92400e", fontSize: "14px", fontWeight: "600" }}>
                        Request Note {idx + 1}
                      </h5>
                      {requestNotes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRequestNote(idx)}
                          style={{
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                      <div>
                        <label style={label}>Department</label>
                        <input
                          style={modernInput}
                          type="text"
                          placeholder="Enter department"
                          value={note.department}
                          onChange={e => handleRequestNoteChange(idx, "department", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={label}>Request</label>
                        <input
                          style={modernInput}
                          type="text"
                          placeholder="Enter request details"
                          value={note.request}
                          onChange={e => handleRequestNoteChange(idx, "request", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={label}>Date</label>
                        <input
                          style={modernInput}
                          type="date"
                          value={note.date}
                          onChange={e => handleRequestNoteChange(idx, "date", e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={label}>Agent</label>
                        <input
                          style={modernInput}
                          type="text"
                          placeholder="Enter agent name"
                          value={note.agent}
                          onChange={e => handleRequestNoteChange(idx, "agent", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={handleAddRequestNote}
                  style={{
                    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                    color: "white",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "transform 0.2s",
                    boxShadow: "0 4px 12px rgba(251, 191, 36, 0.3)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  ➕ Add a Line!
                </button>
              </div>
            </div>

            {/* Insurance Service Payment Form (shown when Insurance Service is checked) */}
            {insuranceService && (
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
                  Insurance Service Payments
                </h4>
                
                {insurancePayments.map((payment, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 16, 
                    padding: 16, 
                    backgroundColor: "#e8f5e8", 
                    borderRadius: 8,
                    border: "1px solid #c3e6c3"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h5 style={{ margin: 0, color: "#333", fontSize: "14px", fontWeight: "600" }}>
                        Insurance Payment {idx + 1}
                      </h5>
                      {insurancePayments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveInsurancePayment(idx)}
                          style={{
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Payment Date</label>
                        <input
                          style={modernInput}
                          type="date"
                          value={payment.date}
                          onChange={e => handleInsurancePaymentChange(idx, "date", e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Deposit Slip</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleInsurancePaymentChange(idx, "depositSlip", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.depositSlip && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.depositSlip.name}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleInsurancePaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.receipt && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.receipt.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={handleAddInsurancePayment}
                  style={{
                    background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  Add Insurance Payment
                </button>
              </div>
            )}

            {/* ETA Payment Form (shown when ETA is checked) */}
            {eta && (
              <div style={{ marginTop: 20, marginBottom: 20 }}>
                <h4 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
                  ETA Payments
                </h4>
                
                {etaPayments.map((payment, idx) => (
                  <div key={idx} style={{ 
                    marginBottom: 16, 
                    padding: 16, 
                    backgroundColor: "#fff3cd", 
                    borderRadius: 8,
                    border: "1px solid #ffeaa7"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h5 style={{ margin: 0, color: "#333", fontSize: "14px", fontWeight: "600" }}>
                        ETA Payment {idx + 1}
                      </h5>
                      {etaPayments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEtaPayment(idx)}
                          style={{
                            background: "#dc3545",
                            color: "white",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "12px",
                            cursor: "pointer"
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Payment Date</label>
                        <input
                          style={modernInput}
                          type="date"
                          value={payment.date}
                          onChange={e => handleEtaPaymentChange(idx, "date", e.target.value)}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Deposit Slip</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleEtaPaymentChange(idx, "depositSlip", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.depositSlip && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.depositSlip.name}
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleEtaPaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {payment.receipt && (
                          <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                            ✓ {payment.receipt.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={handleAddEtaPayment}
                  style={{
                    background: "linear-gradient(135deg, #ffc107 0%, #ff8b94 100%)",
                    color: "white",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    transition: "transform 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  Add ETA Payment
                </button>
              </div>
            )}

            {/* Passport Information */}
            <h4 style={{ margin: "20px 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
              Passport Information
            </h4>
            
            {/* Passport 1 */}
            <div style={{ marginBottom: 16, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "14px", fontWeight: "600" }}>
                Passport 1
              </h5>
              <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Name</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Passport holder name"
                    value={passport1Name}
                    onChange={e => setPassport1Name(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Passport Attachment</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport1Attachment(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport1Attachment && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport1Attachment.name}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport1Visa(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport1Visa && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport1Visa.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Passport 2 */}
            <div style={{ marginBottom: 16, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "14px", fontWeight: "600" }}>
                Passport 2
              </h5>
              <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Name</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Passport holder name"
                    value={passport2Name}
                    onChange={e => setPassport2Name(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Passport Attachment</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport2Attachment(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport2Attachment && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport2Attachment.name}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport2Visa(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport2Visa && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport2Visa.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Passport 3 */}
            <div style={{ marginBottom: 16, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
              <h5 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "14px", fontWeight: "600" }}>
                Passport 3
              </h5>
              <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Name</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Passport holder name"
                    value={passport3Name}
                    onChange={e => setPassport3Name(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Passport Attachment</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport3Attachment(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport3Attachment && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport3Attachment.name}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => setPassport3Visa(e.target.files?.[0] || null)}
                    style={{ fontSize: "14px" }}
                  />
                  {passport3Visa && (
                    <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>
                      ✓ {passport3Visa.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Embassy Information */}
            <h4 style={{ margin: "20px 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
              Embassy Information
            </h4>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Appointment Date</label>
                <input
                  style={modernInput}
                  type="date"
                  value={embassyAppointmentDate}
                  onChange={e => {
                    trackSectionField('embassy-information', 'embassyAppointmentDate', e.target.value, 'Appointment Date');
                    setEmbassyAppointmentDate(e.target.value);
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Release of Visa Date</label>
                <input
                  style={modernInput}
                  type="date"
                  value={visaReleaseDate}
                  onChange={e => {
                    trackSectionField('embassy-information', 'visaReleaseDate', e.target.value, 'Visa Release Date');
                    setVisaReleaseDate(e.target.value);
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Visa Result</label>
                <input
                  style={modernInput}
                  type="text"
                  placeholder="Visa result status"
                  value={visaResult}
                  onChange={e => {
                    trackSectionField('embassy-information', 'visaResult', e.target.value, 'Visa Result');
                    setVisaResult(e.target.value);
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Advisory Date</label>
                <input
                  style={modernInput}
                  type="date"
                  value={advisoryDate}
                  onChange={e => {
                    trackSectionField('embassy-information', 'advisoryDate', e.target.value, 'Advisory Date');
                    setAdvisoryDate(e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Embassy Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSaveEmbassyInfo}
                disabled={isSavingEmbassy}
                style={saveButtonStyle(isSavingEmbassy)}
              >
                {isSavingEmbassy ? "Saving..." : "Save Embassy Information"}
              </button>
            </div>

            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSaveVisaInfo}
                disabled={isSavingVisa}
                style={saveButtonStyle(isSavingVisa)}
              >
                {isSavingVisa ? "Saving..." : "Save Visa Information"}
              </button>
            </div>
          </div>

          {/* Activity Log Section - Moved to Right Sidebar */}
          
          {/* File Attachments Section */}
          <div style={{ ...sectionStyle, marginTop: "24px" }}>
            {/* Section Header */}
            <div style={sectionHeader}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📎</span>
              <h2 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "20px", 
                fontWeight: 700,
                letterSpacing: "-0.025em"
              }}>
                File Attachment History
              </h2>
            </div>
            <FileAttachmentList
              attachments={attachments}
              allowDelete={true}
              onFileDeleted={(fileId: string) => {
                console.log('File deleted:', fileId);
                // Reload client-specific attachments after deletion
                const currentClientId = clientId || tempClientId;
                if (currentClientId) {
                  const clientAttachments = FileService.getFilesByClient(currentClientId);
                  setAttachments(clientAttachments);
                } else {
                  setAttachments([]);
                }
              }}
            />
          </div>
        </form>
      </div>

      {/* Right Sidebar - Activity Log */}
      <div style={{
        width: '400px',
        flexShrink: 0,
        position: 'sticky',
        top: '20px',
        height: 'fit-content',
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto'
      }}>
        {currentClientId ? (
          <LogNoteComponent
            key={logRefreshKey}
            clientId={currentClientId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        ) : (
          <div style={{
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(147, 197, 253, 0.3)',
            height: 'fit-content'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              color: '#1e293b',
              fontSize: '1.25rem',
              fontWeight: '600'
            }}>
              Activity Log
            </h3>
            <p style={{
              color: '#64748b',
              fontSize: '13px',
              textAlign: 'center',
              padding: '24px 16px'
            }}>
              Activity log will appear when a client is selected.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

interface MainPageProps {
  currentUser: { fullName: string; username: string };
  onUpdateUser?: (user: { fullName: string; username: string }) => void;
}

const MainPage: React.FC<MainPageProps> = ({ currentUser, onUpdateUser }) => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  // Navigation state for form view - restore from sessionStorage on page load
  const [viewingForm, setViewingForm] = useState<{clientId?: string, clientName?: string} | null>(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewingForm || null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const [viewProfile, setViewProfile] = useState(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewProfile || false;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [viewDeleted, setViewDeleted] = useState(false);
  const [viewActivityLog, setViewActivityLog] = useState(false);
  const [viewAdminPanel, setViewAdminPanel] = useState(false);

  // Save view state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('crm_current_view', JSON.stringify({
      viewingForm,
      viewProfile
    }));
  }, [viewingForm, viewProfile]);

  // Check if current user is admin
  const isAdmin = () => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return false;
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: any) => u.fullName === currentUser.fullName);
      return user && user.role === 'admin';
    } catch {
      return false;
    }
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const allClients = await ClientService.searchClients({
        searchTerm: searchQuery,
        status: statusFilter || undefined
      });
      setClients(allClients);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadClients();
    
    // Listen for client data updates
    const handleClientUpdate = () => {
      loadClients();
    };
    
    window.addEventListener('clientDataUpdated', handleClientUpdate);
    
    return () => {
      window.removeEventListener('clientDataUpdated', handleClientUpdate);
    };
  }, [loadClients]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleClientEdit = (client: ClientData) => {
    setViewingForm({clientId: client.id, clientName: client.contactName});
  };

  const handleAddNewClient = () => {
    setViewingForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '#4CAF50';
      case 'lead': return '#2196F3';
      case 'referral': return '#FF9800';
      case 'transferred': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  const handleNavigateToClientRecords = () => {
    // This function is no longer needed since we're on the records page by default
  };

  return (
    <>
      {viewingForm ? (
        <ClientRecords
          onClientSelect={() => {}}
          onNavigateBack={() => setViewingForm(null)}
          clientId={viewingForm.clientId}
          currentUser={currentUser}
        />
      ) : viewProfile ? (
        <div style={{ display: 'flex' }}>
          <Sidebar 
            onNavigateToClientRecords={() => setViewProfile(false)}
            onNavigateToProfile={() => setViewProfile(true)}
            onNavigateToDeleted={() => {
              setViewProfile(false);
              setViewDeleted(true);
            }}
            onNavigateToActivityLog={() => {
              setViewProfile(false);
              setViewActivityLog(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewProfile(false);
              setViewAdminPanel(true);
            } : undefined}
          />
          <div style={{
            marginLeft: '300px',
            width: 'calc(100% - 300px)',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5'
          }}>
            <UserProfile
              currentUser={currentUser}
              onBack={() => setViewProfile(false)}
              onUpdateUser={(userData) => {
                if (onUpdateUser) {
                  onUpdateUser({ fullName: userData.fullName, username: userData.username });
                }
              }}
            />
          </div>
        </div>
      ) : viewDeleted ? (
        <div style={{ display: 'flex' }}>
          <Sidebar 
            onNavigateToClientRecords={() => {
              setViewDeleted(false);
              loadClients();
            }}
            onNavigateToProfile={() => {
              setViewDeleted(false);
              setViewProfile(true);
            }}
            onNavigateToDeleted={() => setViewDeleted(true)}
            onNavigateToActivityLog={() => {
              setViewDeleted(false);
              setViewActivityLog(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewDeleted(false);
              setViewAdminPanel(true);
            } : undefined}
          />
          <div style={{
            marginLeft: '300px',
            padding: '20px',
            width: 'calc(100% - 300px)',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5'
          }}>
            <DeletedClients
              currentUser={currentUser.fullName}
              onBack={() => {
                setViewDeleted(false);
                loadClients();
              }}
            />
          </div>
        </div>
      ) : viewActivityLog ? (
        <div style={{ display: 'flex' }}>
          <Sidebar 
            onNavigateToClientRecords={() => {
              setViewActivityLog(false);
              loadClients();
            }}
            onNavigateToProfile={() => {
              setViewActivityLog(false);
              setViewProfile(true);
            }}
            onNavigateToDeleted={() => {
              setViewActivityLog(false);
              setViewDeleted(true);
            }}
            onNavigateToActivityLog={() => setViewActivityLog(true)}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewActivityLog(false);
              setViewAdminPanel(true);
            } : undefined}
          />
          <div style={{
            marginLeft: '300px',
            padding: '20px',
            width: 'calc(100% - 300px)',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5'
          }}>
            <ActivityLogViewer
              onBack={() => setViewActivityLog(false)}
            />
          </div>
        </div>
      ) : viewAdminPanel ? (
        <div style={{ display: 'flex' }}>
          <Sidebar 
            onNavigateToClientRecords={() => {
              setViewAdminPanel(false);
              loadClients();
            }}
            onNavigateToProfile={() => {
              setViewAdminPanel(false);
              setViewProfile(true);
            }}
            onNavigateToDeleted={() => {
              setViewAdminPanel(false);
              setViewDeleted(true);
            }}
            onNavigateToActivityLog={() => {
              setViewAdminPanel(false);
              setViewActivityLog(true);
            }}
            onNavigateToAdminPanel={() => setViewAdminPanel(true)}
          />
          <div style={{
            marginLeft: '300px',
            width: 'calc(100% - 300px)',
            minHeight: '100vh'
          }}>
            <AdminPanel
              onBack={() => setViewAdminPanel(false)}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex' }}>
          <Sidebar 
            onNavigateToClientRecords={handleNavigateToClientRecords}
            onNavigateToProfile={() => setViewProfile(true)}
            onNavigateToDeleted={() => setViewDeleted(true)}
            onNavigateToActivityLog={() => setViewActivityLog(true)}
            onNavigateToAdminPanel={isAdmin() ? () => setViewAdminPanel(true) : undefined}
          />
          <div style={{
            marginLeft: '300px',
            padding: '20px',
            width: 'calc(100% - 300px)',
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            display: 'flex',
            flexDirection: 'column'
          }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 10px 0',
              color: '#2c3e50',
              fontSize: '28px'
            }}>
              Client Records
            </h1>
            <p style={{ 
              margin: 0,
              color: '#7f8c8d',
              fontSize: '14px'
            }}>
              Manage and search through all client documents
            </p>
          </div>
          <button
            onClick={handleAddNewClient}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.3s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
          >
            + Add New Client
          </button>
        </div>

        {/* Search and Filter Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '20px',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Search Clients
              </label>
              <input
                type="text"
                placeholder="Search by name, email, client number, or phone..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3498db'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                            <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Float">Float</option>
                <option value="Refund">Refund</option>
                <option value="Travel Funds">Travel Funds</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
            <p>Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
              👥
            </div>
            <h3 style={{ color: '#6c757d', margin: '0 0 8px 0' }}>
              {searchQuery || statusFilter ? 'No Clients Found' : 'No Clients Yet'}
            </h3>
            <p style={{ color: '#adb5bd', margin: 0 }}>
              {searchQuery || statusFilter 
                ? 'Try adjusting your search criteria or filters.'
                : 'Start by adding your first client to the system.'
              }
            </p>
            {!searchQuery && !statusFilter && (
              <button
                onClick={handleAddNewClient}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Add First Client
              </button>
            )}
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e9ecef',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>
                Client List ({clients.length} {clients.length === 1 ? 'client' : 'clients'})
              </h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse'
              }}>
                <thead style={{
                  backgroundColor: '#f8f9fa',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1
                }}>
                  <tr>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Client Name
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Status
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Email
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Phone
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Client No.
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'left',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Agent
                    </th>
                    <th style={{
                      padding: '12px 20px',
                      textAlign: 'center',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#6c757d',
                      borderBottom: '2px solid #dee2e6',
                      whiteSpace: 'nowrap'
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => (
                    <tr
                      key={client.id}
                      style={{
                        borderBottom: index < clients.length - 1 ? '1px solid #e9ecef' : 'none',
                        transition: 'background-color 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      onClick={() => handleClientEdit(client)}
                    >
                      <td style={{
                        padding: '16px 20px',
                        color: '#2c3e50',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}>
                        {client.contactName}
                      </td>
                      <td style={{
                        padding: '16px 20px'
                      }}>
                        <span style={{
                          padding: '4px 12px',
                          backgroundColor: getStatusColor(client.status || 'unknown'),
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'inline-block'
                        }}>
                          {client.status}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        color: '#6c757d',
                        fontSize: '13px'
                      }}>
                        📧 {client.email || 'No email'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        color: '#6c757d',
                        fontSize: '13px'
                      }}>
                        📞 {client.contactNo || 'No phone'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        color: '#6c757d',
                        fontSize: '13px'
                      }}>
                        {client.clientNo || 'N/A'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        color: '#6c757d',
                        fontSize: '13px'
                      }}>
                        {client.agent || 'Unassigned'}
                      </td>
                      <td style={{
                        padding: '16px 20px',
                        textAlign: 'center'
                      }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClientEdit(client);
                            }}
                            style={{
                              padding: '6px 16px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease',
                              fontWeight: '500'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Are you sure you want to delete client "${client.contactName}"? This can be recovered from the Deleted Clients page.`)) {
                                const success = ClientService.deleteClient(client.id, currentUser.fullName);
                                if (success) {
                                  ActivityLogService.addLog({
                                    clientId: client.id,
                                    clientName: client.contactName || 'Unknown',
                                    action: 'deleted',
                                    performedBy: currentUser.fullName,
                                    performedByUser: currentUser.fullName,
                                    details: `Client moved to trash`
                                  });
                                  alert('Client moved to trash. You can recover it from Deleted Clients page.');
                                }
                                loadClients();
                              }
                            }}
                            style={{
                              padding: '6px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease',
                              fontWeight: '500'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </>
  );
};

export default MainPage;