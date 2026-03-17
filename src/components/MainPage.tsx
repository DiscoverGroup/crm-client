import React, { useState, useEffect, useCallback, useRef } from 'react';
import { sanitizeName, sanitizeEmail, sanitizePhone, sanitizeText, containsAttackPatterns } from '../utils/formSanitizer';
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
import TeamCalendar from './TeamCalendar';
import { ActivityLogService } from '../services/activityLogService';
import R2DownloadButton from './R2DownloadButton';
import Loader from './Loader';
import { showSuccessToast, showErrorToast, showWarningToast, showConfirmDialog } from '../utils/toast';
import { useWindowWidth } from '../hooks/useWindowWidth';

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
const sectionStyle = (w: number): React.CSSProperties => ({
  background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)",
  padding: w < 640 ? "16px" : "32px",
  marginBottom: w < 640 ? "16px" : "32px",
  border: "1px solid rgba(147, 197, 253, 0.3)",
  position: "relative" as const,
  overflow: "hidden" as const
});

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
  { value: "travel_funds", label: "Travel Funds", terms: 0 },
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
  currentUser?: { fullName: string; username: string; id?: string; email?: string };
}> = ({ onNavigateBack, clientId, currentUser: propsCurrentUser }) => {
  const windowWidth = useWindowWidth();
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
  const [bookingConfirmations, setBookingConfirmations] = useState<string[]>([""]);
  
  // Generate temporary client ID for new clients
  const [tempClientId] = useState(() => clientId || `temp_${Date.now()}`);
  const [packageLink, setPackageLink] = useState("");
  
  // Resolved client ID — updated to the real CLT-xxx after first save of a new client
  const [resolvedClientId, setResolvedClientId] = useState<string | undefined>(clientId);

  // Log refresh state
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  
  // Incremented when sync:clients fires so the form reloads fresh data
  const [clientDataVersion, setClientDataVersion] = useState(0);
  
  // Mobile Activity Log toggle state
  const [showMobileActivityLog, setShowMobileActivityLog] = useState(false);
  
  // Loading state for clients
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  
  // Field tracking setup
  const currentClientId = resolvedClientId || clientId || tempClientId;
  const currentUserId = propsCurrentUser?.id || "unknown_user";
  const currentUserName = propsCurrentUser?.fullName || "Current User"; // Use prop or fallback
  
  // Get current user's profile image R2 path
  const getCurrentUserProfileImagePath = (): string | undefined => {
    const users = localStorage.getItem('crm_users');
    if (users) {
      const userList = JSON.parse(users);
      const user = userList.find((u: any) => u.fullName === propsCurrentUser?.fullName);
      return user?.profileImageR2Path;
    }
    return undefined;
  };
  
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

  // Reload form fields whenever client data changes on another device.
  // sync:clients fires BEFORE localStorage is updated, so we must call
  // syncFromMongoDB first to fetch fresh data, then bump the version to
  // make the form re-read from the now-updated localStorage.
  useEffect(() => {
    const onClientsSync = () => {
      ClientService.syncFromMongoDB().then(() => {
        setClientDataVersion(v => v + 1);
      }).catch(() => {});
    };
    // syncSuccess fires after any sync completes (periodic, etc.)
    const onSyncSuccess = () => {
      setClientDataVersion(v => v + 1);
    };
    window.addEventListener('sync:clients', onClientsSync);
    window.addEventListener('syncSuccess', onSyncSuccess);
    return () => {
      window.removeEventListener('sync:clients', onClientsSync);
      window.removeEventListener('syncSuccess', onSyncSuccess);
    };
  }, []);

  // Load existing client data if clientId is provided (or when synced data arrives)
  useEffect(() => {
    if (clientId) {
      setIsLoadingClients(true);
      try {
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
          setBookingConfirmations(
            Array.isArray(existingClient.bookingConfirmations)
              ? existingClient.bookingConfirmations
              : existingClient.bookingConfirmation
                ? [existingClient.bookingConfirmation]
                : [""]
          );
          setPackageLink(existingClient.packageLink || '');
          if (existingClient.companions) {
            setCompanions(existingClient.companions);
          }
          // Visa & embassy fields
          setVisaService(existingClient.visaService || false);
          setInsuranceService(existingClient.insuranceService || false);
          setEta(existingClient.etaService || false);
          setEmbassyAppointmentDate(existingClient.embassyAppointmentDate || '');
          setVisaReleaseDate(existingClient.visaReleaseDate || '');
          setVisaResult(existingClient.visaResult || '');
          setAdvisoryDate(existingClient.advisoryDate || '');

          // Load request notes
          if ((existingClient as any).requestNotes && Array.isArray((existingClient as any).requestNotes)) {
            setRequestNotes((existingClient as any).requestNotes);
            savedRequestNotesRef.current = JSON.parse(JSON.stringify((existingClient as any).requestNotes));
          }

          // Load saved payment data for existing client
          const savedPayment = PaymentService.getPaymentData(clientId);
          if (savedPayment) {
            if (savedPayment.paymentTerm) setPaymentTerm(savedPayment.paymentTerm as string);
            if (typeof savedPayment.termCount === 'number') setTermCount(savedPayment.termCount);
            if (savedPayment.selectedPaymentBox !== undefined) setSelectedPaymentBox(savedPayment.selectedPaymentBox as number | null);
            if (Array.isArray(savedPayment.paymentDetails)) {
              setPaymentDetails(savedPayment.paymentDetails.map((d: any) => ({
                date: (d.date as string) || '',
                depositSlip: null,
                receipt: null,
              })));
            }
          }
        }
      } finally {
        setIsLoadingClients(false);
      }
    }
  }, [clientId, clientDataVersion]);

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
  
  const handleBookingConfirmationChange = (index: number, value: string) => {
    const updated = [...bookingConfirmations];
    updated[index] = value;
    trackSectionField('package-information', 'bookingConfirmations', updated.filter(b => b.trim()).join(', '), 'Booking Confirmation');
    setBookingConfirmations(updated);
  };

  const handleAddBookingConfirmation = () => {
    setBookingConfirmations(prev => [...prev, ""]);
  };

  const handleRemoveBookingConfirmation = (index: number) => {
    if (bookingConfirmations.length <= 1) return;
    setBookingConfirmations(prev => prev.filter((_, i) => i !== index));
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
  
  const [secondPaymentDate, _setSecondPaymentDate] = useState("");
  const [secondPaymentDepositSlip, _setSecondPaymentDepositSlip] = useState<File | null>(null);
  const [secondPaymentReceipt, _setSecondPaymentReceipt] = useState<File | null>(null);
  
  const [thirdPaymentDate, _setThirdPaymentDate] = useState("");
  const [thirdPaymentDepositSlip, _setThirdPaymentDepositSlip] = useState<File | null>(null);
  const [thirdPaymentReceipt, _setThirdPaymentReceipt] = useState<File | null>(null);
  
  const [otherPaymentsEnabled, setOtherPaymentsEnabled] = useState(false);
  const [otherPaymentsDescription, setOtherPaymentsDescription] = useState("");
  const [otherPaymentsAttachment, setOtherPaymentsAttachment] = useState<File | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Visa section states
  const [visaFOC, setVisaFOC] = useState(false);
  const [insuranceFOC, setInsuranceFOC] = useState(false);
  const [visaService, setVisaService] = useState(false);
  const [insuranceService, setInsuranceService] = useState(false);
  const [eta, setEta] = useState(false);
  
  // Passport attachments (for up to 3 passports)
  const [passport1Name, setPassport1Name] = useState("");
  const [_passport1Attachment, setPassport1Attachment] = useState<File | null>(null);
  const [_passport1Visa, setPassport1Visa] = useState<File | null>(null);
  
  const [passport2Name, setPassport2Name] = useState("");
  const [_passport2Attachment, setPassport2Attachment] = useState<File | null>(null);
  const [_passport2Visa, setPassport2Visa] = useState<File | null>(null);
  
  const [passport3Name, setPassport3Name] = useState("");
  const [_passport3Attachment, setPassport3Attachment] = useState<File | null>(null);
  const [_passport3Visa, setPassport3Visa] = useState<File | null>(null);
  
  // Embassy information
  const [embassyAppointmentDate, setEmbassyAppointmentDate] = useState("");
  const [visaReleaseDate, setVisaReleaseDate] = useState("");
  const [visaResult, setVisaResult] = useState("");
  const [advisoryDate, setAdvisoryDate] = useState("");
  const [isSavingVisa, setIsSavingVisa] = useState(false);
  const [isSavingEmbassy, setIsSavingEmbassy] = useState(false);

  // Travel Funds workflow states
  const [travelFundRequestDate, setTravelFundRequestDate] = useState("");
  const [travelFundApprovalStatus, setTravelFundApprovalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [travelFundApprovalDate, setTravelFundApprovalDate] = useState("");
  const [travelFundReleaseDate, setTravelFundReleaseDate] = useState("");
  const [travelFundReleasedAmount, setTravelFundReleasedAmount] = useState("");

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
  const [_intlFlight, setIntlFlight] = useState<File | null>(null);
  const [_localFlight1, setLocalFlight1] = useState<File | null>(null);
  const [_localFlight2, setLocalFlight2] = useState<File | null>(null);
  const [_localFlight3, setLocalFlight3] = useState<File | null>(null);
  const [_localFlight4, setLocalFlight4] = useState<File | null>(null);
  const [_hotelVoucher, setHotelVoucher] = useState<File | null>(null);
  const [_otherFiles, setOtherFiles] = useState<File | null>(null);

  // Notes/Request/Endorsements section states
  type RequestNote = {
    department: string;
    request: string;
    date: string;
    agent: string;
  };
  const [requestNotes, setRequestNotes] = useState<RequestNote[]>([
    { department: "", request: "", date: "", agent: "" }
  ]);
  const savedRequestNotesRef = useRef<RequestNote[]>([]);

  // File attachment state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // PaymentTerm-driven behavior
  const currentOption = paymentOptions.find(opt => opt.value === paymentTerm)!;
  const showTermCount = paymentTerm === "installment";
  const paymentBoxes = Array.from({ length: currentOption.value === "installment" ? termCount : currentOption.terms }, (_, i) => i + 1);

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
        // console.error('Error loading attachments:', error);
      }
    };
    
    loadAttachments();
    
    // Sync from MongoDB and reload
    FileService.syncFromMongoDB().then(() => {
      loadAttachments();
    }).catch(() => {});
    
    // Listen for file updates
    const onFileSync = () => {
      FileService.syncFromMongoDB().then(() => loadAttachments()).catch(() => {});
    };
    window.addEventListener('fileAttachmentUpdated', loadAttachments);
    window.addEventListener('sync:file_attachments', onFileSync);
    return () => {
      window.removeEventListener('fileAttachmentUpdated', loadAttachments);
      window.removeEventListener('sync:file_attachments', onFileSync);
    };
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
      // Validation: File size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        showErrorToast(`File size exceeds 50MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
        event.target.value = ''; // Clear the input
        return;
      }

      // Validation: File type (images and PDFs only)
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        showErrorToast(`Invalid file type. Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed. Your file type: ${file.type}`);
        event.target.value = ''; // Clear the input
        return;
      }

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
        // console.error('Error uploading file:', error);
        showErrorToast('Failed to upload file. Please try again.');
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
    const confirmed = await showConfirmDialog(
      'Remove File',
      'Are you sure you want to remove this file?',
      'warning'
    );
    if (!confirmed) {
      return;
    }

    try {
      // console.log('🗑️ Removing file:', fileId);
      
      // Delete file from FileService
      const success = await FileService.deleteFile(fileId, currentUserName);
      
      // console.log('Delete result:', success);
      
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
        // console.log('Refreshed attachments after deletion:', clientAttachments.length);
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
        
        // console.log('✅ File removed successfully');
      } else {
        showErrorToast('Failed to remove file. Please try again.');
      }
    } catch (error) {
      // console.error('❌ Error removing file:', error);
      showErrorToast('Failed to remove file. Please try again.');
    }
  };

  // Generic file upload handler for booking vouchers and passport attachments
  const handleGenericFileUpload = async (
    file: File,
    category: 'other',
    fileType: string,
    section: string
  ) => {
    try {
      // Validation: File size (max 50MB)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        showErrorToast(`File size exceeds 50MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
        return;
      }

      // Validation: File type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        showErrorToast(`Invalid file type. Only images and PDF files are allowed. Your file type: ${file.type}`);
        return;
      }

      const currentClientId = clientId || tempClientId;
      await FileService.saveFileAttachment(file, category, currentClientId, undefined, undefined, section as any, currentUserName, fileType);
      
      logAttachment(section, 'uploaded', file.name, fileType);
      
      const clientAttachments = FileService.getFilesByClient(currentClientId);
      setAttachments([...clientAttachments]);
      
      window.dispatchEvent(new Event('fileAttachmentUpdated'));
    } catch (error) {
      // console.error('Error uploading file:', error);
      showErrorToast('Failed to upload file. Please try again.');
    }
  };

  // Generic file removal handler
  const handleGenericFileRemove = async (fileId: string, fileType: string, section: string) => {
    const confirmed = await showConfirmDialog(
      'Remove File',
      'Are you sure you want to remove this file?',
      'warning'
    );
    if (!confirmed) {
      return;
    }

    try {
      // console.log('🗑️ Removing file:', fileId);
      const success = await FileService.deleteFile(fileId, currentUserName);
      
      if (success) {
        const currentClientId = clientId || tempClientId;
        const clientAttachments = FileService.getFilesByClient(currentClientId);
        setAttachments([...clientAttachments]);
        
        logAttachment(section, 'deleted', 'File removed', fileType);
        window.dispatchEvent(new Event('fileAttachmentUpdated'));
        
        // console.log('✅ File removed successfully');
      } else {
        showErrorToast('Failed to remove file. Please try again.');
      }
    } catch (error) {
      // console.error('❌ Error removing file:', error);
      showErrorToast('Failed to remove file. Please try again.');
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
        showSuccessToast('Payment details saved successfully!');
      } else {
        logSectionAction(
          'payment-terms-schedule',
          'Save Failed',
          'Failed to save payment details',
          'pending'
        );
        showErrorToast('Failed to save payment details. Please try again.');
      }
    } catch (error) {
      // console.error('Error saving payment details:', error);
      logSectionAction(
        'payment-terms-schedule',
        'Save Error',
        'An error occurred while saving payment details',
        'pending'
      );
      showErrorToast('An error occurred while saving payment details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClientInfo = async () => {
    setIsSavingClient(true);
    try {
      // Validation: Required fields
      if (!contactName || contactName.trim().length < 2) {
        showWarningToast('Contact Name is required (minimum 2 characters)');
        setIsSavingClient(false);
        return;
      }

      // Validation: Email format
      if (email && email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          showWarningToast('Please enter a valid email address');
          setIsSavingClient(false);
          return;
        }
      }

      // Validation: Phone number format (digits, spaces, dashes, parentheses only)
      if (contactNo && contactNo.trim()) {
        const phoneRegex = /^[0-9\s\-\(\)\+]+$/;
        if (!phoneRegex.test(contactNo.trim()) || contactNo.replace(/[^0-9]/g, '').length < 7) {
          showWarningToast('Please enter a valid contact number (minimum 7 digits)');
          setIsSavingClient(false);
          return;
        }
      }

      // Validation: Date of Birth (cannot be future date)
      if (dateOfBirth) {
        const dob = new Date(dateOfBirth);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dob > today) {
          showWarningToast('Date of Birth cannot be in the future');
          setIsSavingClient(false);
          return;
        }
      }

      // Validation: Travel Date (warn if in the past, but allow saving historical records)
      if (travelDate) {
        const travel = new Date(travelDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (travel < today) {
          showWarningToast('Note: Travel Date is in the past');
        }
      }

      // Validation: Number of Pax (must be positive)
      if (numberOfPax < 1) {
        showWarningToast('Number of Passengers must be at least 1');
        setIsSavingClient(false);
        return;
      }

      // Validation: Client number uniqueness (if manually entered)
      // Use resolvedClientId (set after first save) so edits to an existing client
      // are not falsely flagged as duplicates when the clientId prop is still undefined.
      if (clientNo && clientNo.trim()) {
        const existingClients = ClientService.getAllClients();
        const ownId = resolvedClientId || clientId;
        const duplicate = existingClients.find(c => 
          c.clientNo === clientNo.trim() && c.id !== ownId
        );
        if (duplicate) {
          showWarningToast(`Client number "${clientNo.trim()}" is already in use. Please use a different number.`);
          setIsSavingClient(false);
          return;
        }
      }

      // Sanitise inputs before building clientData
      const cleanContactName = sanitizeName(contactName, 200);
      const cleanEmail = sanitizeEmail(email || '');
      const cleanContactNo = sanitizePhone(contactNo || '');
      const cleanPackageName = sanitizeText(packageName || '', 500);
      const cleanPackageLink = sanitizeText(packageLink || '', 1000);
      const cleanAgent = sanitizeName(agent || '', 100);

      // Reject attack patterns in any string field
      const textFields = [cleanContactName, cleanEmail, cleanContactNo, cleanPackageName, cleanAgent];
      if (textFields.some(v => v && containsAttackPatterns(v))) {
        showWarningToast('Invalid characters detected in your input. Please review and try again.');
        setIsSavingClient(false);
        return;
      }

      // Client number is now required - no auto-generation
      if (!clientNo || !clientNo.trim()) {
        showWarningToast('Client Number is required. Please enter a client number.');
        setIsSavingClient(false);
        return;
      }
      const generatedClientNo = clientNo.trim();
      const clientData = {
        clientNo: generatedClientNo,
        status,
        agent: cleanAgent,
        contactNo: cleanContactNo,
        contactName: cleanContactName,
        email: cleanEmail,
        dateOfBirth,
        packageName: cleanPackageName,
        travelDate,
        numberOfPax,
        bookingConfirmations: bookingConfirmations.filter(b => b.trim()),
        packageLink: cleanPackageLink,
        companions: companions
      };

      // Prefer the resolved (post-first-save) ID over the prop so that editing
      // a just-created client in the same session always goes through updateClient.
      const ownId = resolvedClientId || clientId;

      // Capture existing client before overwriting (for field-level change diff)
      const existingClientSnap = ownId ? ClientService.getClientById(ownId) : null;

      // ── Save: update if we already have an id, create otherwise ─────────────
      let savedClientId: string;
      let isNewClient: boolean;

      if (ownId) {
        // Existing client — update by id (not by clientNo, which may have changed)
        await ClientService.updateClient(ownId, {
          ...clientData,
          updatedAt: new Date().toISOString(),
        });
        savedClientId = ownId;
        isNewClient = false;
      } else {
        // Brand-new client
        const result = await ClientService.saveClient(clientData);
        savedClientId = result.clientId;
        isNewClient = result.isNewClient;
      }

      // Build field-level change record for edits
      const CLIENT_FIELD_LABELS: Record<string, string> = {
        clientNo: 'Client Number',
        status: 'Status',
        agent: 'Agent',
        contactNo: 'Contact Number',
        contactName: 'Contact Name',
        email: 'Email',
        dateOfBirth: 'Date of Birth',
      };
      const clientChanges: Record<string, { old: any; new: any }> = {};
      if (!isNewClient && existingClientSnap) {
        for (const [key, label] of Object.entries(CLIENT_FIELD_LABELS)) {
          const oldVal = String((existingClientSnap as any)[key] ?? '');
          const newVal = String((clientData as any)[key] ?? '');
          if (oldVal !== newVal) {
            clientChanges[label] = { old: (existingClientSnap as any)[key] ?? '', new: (clientData as any)[key] ?? '' };
          }
        }
      }

      // Log activity
      if (isNewClient) {
        ActivityLogService.addLog({
          clientId: savedClientId,
          clientName: contactName || 'Unknown',
          action: 'created',
          performedBy: currentUserName,
          performedByUser: currentUserName,
          profileImageR2Path: getCurrentUserProfileImagePath(),
          details: `New client created`,
        });
      } else {
        const changedFields = Object.keys(clientChanges);
        ActivityLogService.addLog({
          clientId: savedClientId,
          clientName: contactName || 'Unknown',
          action: 'edited',
          performedBy: currentUserName,
          performedByUser: currentUserName,
          profileImageR2Path: getCurrentUserProfileImagePath(),
          details: changedFields.length > 0
            ? `Updated: ${changedFields.join(', ')}`
            : 'Client information updated',
          changes: changedFields.length > 0 ? clientChanges : undefined,
        });
      }
      
      // Update resolved client ID and refresh activity log panel
      setResolvedClientId(savedClientId);
      setLogRefreshKey(prev => prev + 1);

      // Save section changes to log
      saveSection('client-information', 'Client Information');
      
      // If this is a brand-new client, migrate temp file/payment associations to the real id
      if (isNewClient && savedClientId && tempClientId !== savedClientId) {
        FileService.updateClientIdForTempFiles(tempClientId, savedClientId);
        // Migrate payment data from temp key to real client ID
        PaymentService.migratePaymentData(tempClientId, savedClientId);
        // Refresh attachments with new client ID
        const clientAttachments = FileService.getFilesByClient(savedClientId);
        setAttachments(clientAttachments);
      }
      
      showSuccessToast('Client information saved successfully!');
      
      // Trigger client list refresh
      window.dispatchEvent(new Event('clientDataUpdated'));
    } catch (error) {
      // console.error('Error saving client info:', error);
      logSectionAction(
        'client-information',
        'Save Failed',
        'Failed to save client information',
        'pending'
      );
      showErrorToast('An error occurred while saving client information.');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleSavePackageInfo = async () => {
    setIsSavingPackage(true);
    try {
      // Ensure we have a clientNo (required for saving)
      if (!clientNo) {
        showWarningToast('Please save client information first before saving package details.');
        return;
      }

      // Ensure we have a clientId (use resolved ID for newly-created clients)
      if (!currentClientId) {
        showWarningToast('Client ID not found. Please save client information first.');
        return;
      }

      // Get the existing client data
      const existingClient = ClientService.getClientById(currentClientId);
      if (!existingClient) {
        showWarningToast('Client not found. Please save client information first.');
        return;
      }

      // Sanitise package inputs before saving
      const cleanPackageName = sanitizeName(packageName || '', 500);
      const cleanBookingConfirmations = bookingConfirmations.map(b => sanitizeText(b || '', 200)).filter(b => b.trim());
      const cleanPackageLink = sanitizeText(packageLink || '', 1000);
      const cleanCompanions = companions.map(c => ({
        ...c,
        name: sanitizeName(c.name, 200),
      }));
      if ([cleanPackageName, ...cleanBookingConfirmations, cleanPackageLink].some(v => v && containsAttackPatterns(v))) {
        showWarningToast('Invalid characters detected in package info. Please review and try again.');
        setIsSavingPackage(false);
        return;
      }

      // Update client with package information
      const clientData = {
        ...existingClient,
        packageName: cleanPackageName,
        travelDate,
        numberOfPax,
        bookingConfirmations: cleanBookingConfirmations,
        packageLink: cleanPackageLink,
        companions: cleanCompanions
      };

      // Save to ClientService
      await ClientService.saveClient(clientData);

      // Build field-level change record for package fields
      const PKG_FIELD_LABELS: Record<string, string> = {
        packageName: 'Package Name',
        travelDate: 'Travel Date',
        numberOfPax: 'Number of Pax',
        bookingConfirmations: 'Booking Confirmation',
        packageLink: 'Package Link',
      };
      const pkgChanges: Record<string, { old: any; new: any }> = {};
      for (const [key, label] of Object.entries(PKG_FIELD_LABELS)) {
        const oldVal = String((existingClient as any)[key] ?? '');
        const newVal = String((clientData as any)[key] ?? '');
        if (oldVal !== newVal) {
          pkgChanges[label] = { old: (existingClient as any)[key] ?? '', new: (clientData as any)[key] ?? '' };
        }
      }
      const pkgChangedFields = Object.keys(pkgChanges);

      // Log activity
      ActivityLogService.addLog({
        clientId: clientId || currentClientId,
        clientName: contactName || 'Unknown',
        action: 'edited',
        performedBy: currentUserName,
        performedByUser: currentUserName,
        profileImageR2Path: getCurrentUserProfileImagePath(),
        details: pkgChangedFields.length > 0
          ? `Updated: ${pkgChangedFields.join(', ')}`
          : 'Package & travel information updated',
        changes: pkgChangedFields.length > 0 ? pkgChanges : undefined,
      });
      setLogRefreshKey(prev => prev + 1);
      
      // Save section changes to log
      saveSection('package-information', 'Package & Companions');
      
      showSuccessToast('Package & companions information saved successfully!');
      
      // Trigger client list refresh
      window.dispatchEvent(new Event('clientDataUpdated'));
    } catch (error) {
      // console.error('Error saving package info:', error);
      logSectionAction(
        'package-information',
        'Save Failed',
        'Failed to save package information',
        'pending'
      );
      showErrorToast('An error occurred while saving package information.');
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleSaveVisaInfo = async () => {
    setIsSavingVisa(true);
    try {
      if (!currentClientId) {
        showWarningToast('Please save client information first before saving visa details.');
        return;
      }
      await ClientService.updateClient(currentClientId, {
        visaService,
        insuranceService,
        etaService: eta,
      });
      saveSection('visa-service', 'Visa & Additional Services');
      showSuccessToast('Visa information saved successfully!');
    } catch (error) {
      // console.error('Error saving visa info:', error);
      showErrorToast('An error occurred while saving visa information.');
    } finally {
      setIsSavingVisa(false);
    }
  };

  const handleSaveEmbassyInfo = async () => {
    setIsSavingEmbassy(true);
    try {
      if (!currentClientId) {
        showWarningToast('Please save client information first before saving embassy details.');
        return;
      }
      await ClientService.updateClient(currentClientId, {
        embassyAppointmentDate,
        visaReleaseDate,
        visaResult,
        advisoryDate,
      });
      // Save section changes to log
      saveSection('embassy-information', 'Embassy Information');
      showSuccessToast('Embassy information saved successfully!');
    } catch (error) {
      // console.error('Error saving embassy info:', error);
      logSectionAction(
        'embassy-information',
        'Save Failed',
        'Failed to save embassy information',
        'pending'
      );
      showErrorToast('An error occurred while saving embassy information.');
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
        // console.error('Error uploading visa payment file:', error);
        showErrorToast('Failed to upload file. Please try again.');
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
        // console.error('Error uploading insurance payment file:', error);
        showErrorToast('Failed to upload file. Please try again.');
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
        // console.error('Error uploading ETA payment file:', error);
        showErrorToast('Failed to upload file. Please try again.');
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

  const handleSaveRequestNotes = async () => {
    if (!currentClientId) {
      showWarningToast('Please save client information first before saving request notes.');
      return;
    }
    try {
      await ClientService.updateClient(currentClientId, { requestNotes } as any);
      
      // Build detailed change log comparing old vs new notes
      const oldNotes = savedRequestNotesRef.current;
      const changes: string[] = [];

      // Check for modified and new notes
      requestNotes.forEach((note, i) => {
        const old = oldNotes[i];
        const isFilled = note.department || note.request || note.date || note.agent;
        if (!old) {
          // New note added
          if (isFilled) {
            changes.push(`Added Note ${i + 1}: Dept="${note.department || '(empty)'}" Request="${note.request || '(empty)'}" Date="${note.date || '(empty)'}" Agent/Officer="${note.agent || '(empty)'}"`);
          }
        } else {
          // Existing note — check each field
          const fields: { key: keyof RequestNote; label: string }[] = [
            { key: 'department', label: 'Department' },
            { key: 'request', label: 'Request' },
            { key: 'date', label: 'Date' },
            { key: 'agent', label: 'Agent/Officer' }
          ];
          fields.forEach(({ key, label }) => {
            if ((note[key] || '') !== (old[key] || '')) {
              changes.push(`Note ${i + 1} ${label}: "${old[key] || '(empty)'}" → "${note[key] || '(empty)'}"`);
            }
          });
        }
      });

      // Check for removed notes
      if (oldNotes.length > requestNotes.length) {
        for (let i = requestNotes.length; i < oldNotes.length; i++) {
          const old = oldNotes[i];
          if (old.department || old.request || old.date || old.agent) {
            changes.push(`Removed Note ${i + 1}: Dept="${old.department || '(empty)'}" Request="${old.request || '(empty)'}"`);
          }
        }
      }

      if (changes.length > 0) {
        logSectionAction('Notes/Request/Endorsements', 'Updated', changes.join('\n'));
      } else {
        const filledNotes = requestNotes.filter(n => n.department || n.request || n.date || n.agent);
        if (filledNotes.length > 0) {
          logSectionAction('Notes/Request/Endorsements', 'Saved', `${filledNotes.length} request note(s) (no changes)`);
        }
      }

      // Update the saved reference for future comparisons
      savedRequestNotesRef.current = JSON.parse(JSON.stringify(requestNotes));
      
      showSuccessToast('Request notes saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving request notes.');
    }
  };

  // Handlers
  function handleCompanionFieldChange(field: keyof Companion, value: string) {
    setNewCompanion({ ...newCompanion, [field]: value });
  }

  function handleAddCompanion() {
    const name = newCompanion.name.trim();
    
    // Validation: Minimum 2 characters
    if (name.length < 2) {
      showWarningToast('Companion name must be at least 2 characters');
      return;
    }
    
    // Validation: Cannot be numbers only
    if (/^[0-9]+$/.test(name)) {
      showWarningToast('Companion name cannot be numbers only');
      return;
    }
    
    // Validation: Check for duplicate names
    const isDuplicate = companions.some(c => c.name.trim().toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      showWarningToast(`Companion "${name}" already exists in the list.`);
      return;
    }
    
    setCompanions([...companions, { ...newCompanion, name }]);
    logAction(
      'Companion Added',
      `Added companion: ${name}`,
      'done'
    );
    setNewCompanion({ name: "", dob: "", address: "", occupation: "" });
  }

  function handleRemoveCompanion(idx: number) {
    const removedCompanion = companions[idx];
    setCompanions(companions.filter((_, i) => i !== idx));
    
    // Log activity
    ActivityLogService.addLog({
      clientId: clientId || tempClientId,
      clientName: contactName || 'Unknown',
      action: 'edited',
      performedBy: currentUserName,
      performedByUser: currentUserName,
      profileImageR2Path: getCurrentUserProfileImagePath(),
      details: `Removed companion: ${removedCompanion.name}`
    });
    
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
    if (selected === "installment") {
      setTermCount(1); // start at 1, let user choose
      trackSectionField('payment-terms-schedule', 'termCount', 1, 'Number of Terms');
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
      background: "linear-gradient(135deg, #e1f4fd 0%, #cde9fb 50%, #b8ddf9 100%)",
      position: 'relative'
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "40px auto",
        padding: "0 20px",
        display: 'flex',
        gap: '24px',
        alignItems: 'flex-start',
        position: 'relative'
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
          {isLoadingClients ? (
            <Loader message="Loading client information..." />
          ) : (
          <>
          {/* Header */}
          <div style={{ 
            background: "linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)", 
            borderRadius: "16px", 
            padding: windowWidth < 640 ? "16px" : "32px", 
            marginBottom: "32px",
            boxShadow: "0 8px 32px rgba(59, 130, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.05)",
            border: "1px solid rgba(147, 197, 253, 0.3)",
            display: 'flex',
            flexDirection: windowWidth < 640 ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: windowWidth < 640 ? 'flex-start' : 'center',
            gap: windowWidth < 640 ? '16px' : '24px',
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
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: windowWidth < 640 ? '8px' : '12px' }}>
                <span style={{ fontSize: windowWidth < 640 ? '24px' : '28px' }}>👤</span>
                <h1 style={{ 
                  margin: 0, 
                  color: "#1e293b", 
                  fontSize: windowWidth < 640 ? '20px' : '28px', 
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #1e293b 0%, #3b82f6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.025em",
                  whiteSpace: 'normal'
                }}>
                  New Client Registration
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onNavigateBack}
              style={{
                padding: windowWidth < 640 ? '10px 16px' : '12px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: windowWidth < 640 ? '12px' : '14px',
                fontWeight: '500',
                transition: 'background-color 0.3s ease',
                width: windowWidth < 640 ? '100%' : 'auto',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
            >
              ← Back to Dashboard
            </button>
          </div>
          
          {/* Client Info */}
          <div style={sectionStyle(windowWidth)}>
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
            <div className="form-row" style={{ display: "flex", gap: windowWidth < 640 ? 16 : 32, flexWrap: "wrap" }}>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Client No <span style={{ color: '#ef4444', fontSize: '13px' }}>*</span></label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Enter client number"
                  value={clientNo}
                  onChange={e => setClientNoTracked(e.target.value)}
                  required
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
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
                  <option>Rebook</option>
                  <option>Cancelled</option>
                </select>
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Agent/Officer</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Enter agent/officer name"
                  maxLength={100}
                  value={agent}
                  onChange={e => setAgentTracked(e.target.value)}
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Contact No</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Enter contact number (e.g., +63 912 345 6789)"
                  maxLength={20}
                  value={contactNo}
                  onChange={e => setContactNoTracked(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row" style={{ display: "flex", gap: windowWidth < 640 ? 16 : 32, marginTop: 18, flexWrap: "wrap" }}>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Contact Name</label>
                <input 
                  style={{ ...modernInput, fontWeight: "bold" }} 
                  type="text" 
                  placeholder="Enter client full name"
                  maxLength={100}
                  value={contactName}
                  onChange={e => setContactNameTracked(e.target.value)}
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Email</label>
                <input
                  style={modernInput}
                  type="email"
                  placeholder="Enter email address (e.g., client@example.com)"
                  maxLength={100}
                  value={email}
                  onChange={e => setEmailTracked(e.target.value)}
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Date of Birth</label>
                <input 
                  style={modernInput} 
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  value={dateOfBirth}
                  onChange={e => setDateOfBirthTracked(e.target.value)}
                />
              </div>
            </div>
            {/* Save Button */}
            <div style={{ display: "flex", flexDirection: windowWidth < 640 ? 'column' : 'row', justifyContent: "flex-end", marginTop: 16, gap: '12px', alignItems: windowWidth < 640 ? 'stretch' : 'center' }}>
              <span style={{ fontSize: windowWidth < 640 ? '12px' : '13px', color: '#dc2626', fontWeight: '500', order: windowWidth < 640 ? 2 : 0 }}>
                ⚠️ Remember to save changes before leaving!
              </span>
              <button
                type="button"
                onClick={handleSaveClientInfo}
                disabled={isSavingClient}
                style={{ ...saveButtonStyle(isSavingClient), width: windowWidth < 640 ? '100%' : 'auto' }}
              >
                {isSavingClient ? "Saving..." : "💾 Save Client Info"}
              </button>
            </div>
          </div>

          {/* Package & Companions */}
          <div style={sectionStyle(windowWidth)}>
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
            <div className="form-row" style={{ display: "flex", gap: windowWidth < 640 ? 16 : 32, flexWrap: "wrap" }}>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Package</label>
                <input 
                  style={modernInput} 
                  type="text" 
                  placeholder="Enter tour/package name"
                  maxLength={150}
                  value={packageName}
                  onChange={e => setPackageNameTracked(e.target.value)}
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>Travel Date</label>
                <input 
                  style={modernInput} 
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={travelDate}
                  onChange={e => setTravelDateTracked(e.target.value)}
                />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <label style={label}>No. of Pax</label>
                <input 
                  style={modernInput} 
                  type="number" 
                  min={1}
                  value={numberOfPax}
                  onChange={e => setNumberOfPaxTracked(parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>
            <div className="form-row" style={{ display: "flex", gap: windowWidth < 640 ? 16 : 32, marginTop: 18, flexWrap: "wrap" }}>
              <div className="form-field" style={{ flex: 1, minWidth: windowWidth < 640 ? "100%" : "200px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={label}>Booking Confirmation</label>
                  <button
                    type="button"
                    onClick={handleAddBookingConfirmation}
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      border: "none",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      cursor: "pointer",
                      fontSize: "16px",
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      lineHeight: 1,
                      padding: 0
                    }}
                    title="Add another booking confirmation"
                  >+</button>
                </div>
                {bookingConfirmations.map((bc, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx > 0 ? 8 : 0 }}>
                    <input
                      style={{ ...modernInput, flex: 1 }}
                      type="text"
                      placeholder={`Booking confirmation #${idx + 1}`}
                      maxLength={50}
                      value={bc}
                      onChange={e => handleBookingConfirmationChange(idx, e.target.value)}
                    />
                    {bookingConfirmations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveBookingConfirmation(idx)}
                        style={{
                          background: "#dc3545",
                          color: "white",
                          border: "none",
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          cursor: "pointer",
                          fontSize: "14px",
                          fontWeight: "bold",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                          padding: 0
                        }}
                        title="Remove this booking confirmation"
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ flex: windowWidth < 640 ? '1' : '2', minWidth: windowWidth < 640 ? "100%" : "auto" }}>
                <label style={label}>Package Link</label>
                <input 
                  style={modernInput} 
                  type="url" 
                  placeholder="Enter package URL (e.g., https://...)"
                  maxLength={500}
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
          <div style={sectionStyle(windowWidth)}>
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
              {paymentTerm !== "travel_funds" && showTermCount && (
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
              {paymentTerm !== "travel_funds" && (
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
              )}
            </div>

            {/* Travel Funds Workflow (shown when Travel Funds is selected) */}
            {paymentTerm === "travel_funds" && (
              <div style={{
                marginBottom: 24,
                padding: 20,
                background: "linear-gradient(145deg, rgba(236, 253, 245, 0.9) 0%, rgba(209, 250, 229, 0.7) 100%)",
                borderRadius: 12,
                border: "1px solid rgba(16, 185, 129, 0.3)"
              }}>
                <h4 style={{ margin: "0 0 16px 0", color: "#065f46", fontSize: "16px", fontWeight: "600" }}>
                  💰 Travel Fund Request Workflow
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={label}>Travel Fund Request Date</label>
                    <input
                      style={modernInput}
                      type="date"
                      value={travelFundRequestDate}
                      onChange={e => {
                        trackSectionField('payment-terms-schedule', 'travelFundRequestDate', e.target.value, 'Travel Fund Request Date');
                        setTravelFundRequestDate(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label style={label}>Waiting for Approval</label>
                    <div style={{
                      padding: "14px 16px",
                      borderRadius: "12px",
                      fontSize: "15px",
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: travelFundApprovalStatus === 'approved'
                        ? "rgba(16, 185, 129, 0.15)"
                        : travelFundApprovalStatus === 'rejected'
                        ? "rgba(239, 68, 68, 0.15)"
                        : "rgba(245, 158, 11, 0.15)",
                      color: travelFundApprovalStatus === 'approved'
                        ? "#065f46"
                        : travelFundApprovalStatus === 'rejected'
                        ? "#991b1b"
                        : "#92400e",
                      border: `2px solid ${travelFundApprovalStatus === 'approved' ? 'rgba(16, 185, 129, 0.3)' : travelFundApprovalStatus === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                    }}>
                      <span style={{ fontSize: "18px" }}>
                        {travelFundApprovalStatus === 'approved' ? '✅' : travelFundApprovalStatus === 'rejected' ? '❌' : '⏳'}
                      </span>
                      <select
                        value={travelFundApprovalStatus}
                        onChange={e => {
                          const val = e.target.value as 'pending' | 'approved' | 'rejected';
                          trackSectionField('payment-terms-schedule', 'travelFundApprovalStatus', val, 'Travel Fund Approval Status');
                          setTravelFundApprovalStatus(val);
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "inherit",
                          cursor: "pointer",
                          outline: "none",
                          flex: 1
                        }}
                      >
                        <option value="pending">Pending Approval</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={label}>Approval Date</label>
                    <input
                      style={modernInput}
                      type="date"
                      value={travelFundApprovalDate}
                      onChange={e => {
                        trackSectionField('payment-terms-schedule', 'travelFundApprovalDate', e.target.value, 'Travel Fund Approval Date');
                        setTravelFundApprovalDate(e.target.value);
                      }}
                    />
                  </div>
                  <div>
                    <label style={label}>Fund Release Date</label>
                    <input
                      style={modernInput}
                      type="date"
                      value={travelFundReleaseDate}
                      max={travelFundApprovalDate ? (() => { const d = new Date(travelFundApprovalDate); d.setFullYear(d.getFullYear() + 2); return d.toISOString().split('T')[0]; })() : undefined}
                      onChange={e => {
                        trackSectionField('payment-terms-schedule', 'travelFundReleaseDate', e.target.value, 'Travel Fund Release Date');
                        setTravelFundReleaseDate(e.target.value);
                      }}
                    />
                    <span style={subLabel}>{travelFundApprovalDate ? '(Up to 2 years from approval date)' : '(Set approval date first)'}</span>
                  </div>
                  <div>
                    <label style={label}>Released Amount</label>
                    <input
                      style={modernInput}
                      type="text"
                      placeholder="Enter released amount"
                      value={travelFundReleasedAmount}
                      onChange={e => {
                        // Allow only numbers, decimals, and commas
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        trackSectionField('payment-terms-schedule', 'travelFundReleasedAmount', val, 'Travel Fund Released Amount');
                        setTravelFundReleasedAmount(val);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment Details Table */}
            {paymentTerm !== "travel_funds" && paymentBoxes.length > 0 && (
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
                    <div style={{ flex: 1 }}>
                      <label style={label}>Deposit Slip</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleGenericFileUpload(file, 'other', 'first-payment-deposit', 'first-payment');
                            setFirstPaymentDepositSlip(file);
                          }
                        }}
                        style={{ fontSize: "14px" }}
                      />
                      {(() => {
                        const uploadedFile = attachments.find(att =>
                          att.category === 'other' &&
                          att.source === 'first-payment' &&
                          att.fileType === 'first-payment-deposit'
                        );
                        if (uploadedFile) {
                          return (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                              <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              <button
                                type="button"
                                onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'first-payment-deposit', 'first-payment'); setFirstPaymentDepositSlip(null); }}
                                style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                                title="Remove file"
                              >✕</button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={label}>Receipt</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleGenericFileUpload(file, 'other', 'first-payment-receipt', 'first-payment');
                            setFirstPaymentReceipt(file);
                          }
                        }}
                        style={{ fontSize: "14px" }}
                      />
                      {(() => {
                        const uploadedFile = attachments.find(att =>
                          att.category === 'other' &&
                          att.source === 'first-payment' &&
                          att.fileType === 'first-payment-receipt'
                        );
                        if (uploadedFile) {
                          return (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                              <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              <button
                                type="button"
                                onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'first-payment-receipt', 'first-payment'); setFirstPaymentReceipt(null); }}
                                style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                                title="Remove file"
                              >✕</button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
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
                    <div style={{ flex: 1 }}>
                      <label style={label}>Attachment</label>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleGenericFileUpload(file, 'other', 'other-payment-attachment', 'other-payment');
                            setOtherPaymentsAttachment(file);
                          }
                        }}
                        style={{ fontSize: "14px" }}
                      />
                      {(() => {
                        const uploadedFile = attachments.find(att =>
                          att.category === 'other' &&
                          att.source === 'other-payment' &&
                          att.fileType === 'other-payment-attachment'
                        );
                        if (uploadedFile) {
                          return (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                              <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              <button
                                type="button"
                                onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'other-payment-attachment', 'other-payment'); setOtherPaymentsAttachment(null); }}
                                style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                                title="Remove file"
                              >✕</button>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Legacy Payment Files (uploaded before field tracking) */}
            {(() => {
              const currentClientId3 = clientId || tempClientId;
              const legacyFirstPay = FileService.getLegacyFilesBySource(currentClientId3, 'first-payment');
              const legacyOtherPay = FileService.getLegacyFilesBySource(currentClientId3, 'other-payment');
              const allLegacy = [...legacyFirstPay, ...legacyOtherPay];
              if (allLegacy.length === 0) return null;
              return (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: '8px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#065f46' }}>
                    📁 Previously Uploaded Payment Files ({allLegacy.length})
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#059669' }}>
                    Re-upload to the correct field above, then remove these.
                  </p>
                  {allLegacy.map(att => (
                    <div key={att.file.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#059669' }}>✓ {att.file.name}</span>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>({att.source})</span>
                      <R2DownloadButton r2Path={att.file.r2Path} className="" />
                      <button
                        type="button"
                        onClick={() => handleGenericFileRemove(att.file.id, 'legacy', att.source || 'first-payment')}
                        style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                        title="Remove file"
                      >✕</button>
                    </div>
                  ))}
                </div>
              );
            })()}

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
          <div style={sectionStyle(windowWidth)}>
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
            
            {/* Visa FOC (Free of Charge) Checkbox */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                ...checkboxLabel,
                background: visaFOC ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.7)",
                border: visaFOC ? "2px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(147, 197, 253, 0.2)",
              }}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={visaFOC}
                  onChange={e => setVisaFOC(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: visaFOC ? "#065f46" : "#1e293b", fontWeight: 600 }}>
                  🎁 Visa FOC (Free of Charge)
                </span>
                {visaFOC && (
                  <span style={{ fontSize: "12px", color: "#059669", fontStyle: "italic", marginLeft: 8 }}>
                    — Promo applied, visa services hidden
                  </span>
                )}
              </label>
            </div>

            {/* Insurance FOC (Free of Charge) Checkbox */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                ...checkboxLabel,
                background: insuranceFOC ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.7)",
                border: insuranceFOC ? "2px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(147, 197, 253, 0.2)",
              }}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={insuranceFOC}
                  onChange={e => setInsuranceFOC(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: insuranceFOC ? "#065f46" : "#1e293b", fontWeight: 600 }}>
                  🎁 Insurance FOC (Free of Charge)
                </span>
                {insuranceFOC && (
                  <span style={{ fontSize: "12px", color: "#059669", fontStyle: "italic", marginLeft: 8 }}>
                    — Promo applied, insurance services hidden
                  </span>
                )}
              </label>
            </div>

            {/* Visa Service Options (hidden when FOC is checked) */}
            {!visaFOC && (
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
            )}

            {/* Visa Service Payment Form (shown when Visa Service is checked and NOT FOC) */}
            {!visaFOC && visaService && (
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
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'deposit-slip' &&
                            att.source === 'visa-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.depositSlip) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.depositSlip.name}</div>;
                          }
                          return null;
                        })()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleVisaPaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'receipt' &&
                            att.source === 'visa-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.receipt) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.receipt.name}</div>;
                          }
                          return null;
                        })()}
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

            {/* Insurance Service Payment Form (shown when Insurance Service is checked and NOT FOC) */}
            {!insuranceFOC && insuranceService && (
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
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'deposit-slip' &&
                            att.source === 'insurance-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.depositSlip) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.depositSlip.name}</div>;
                          }
                          return null;
                        })()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleInsurancePaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'receipt' &&
                            att.source === 'insurance-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.receipt) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.receipt.name}</div>;
                          }
                          return null;
                        })()}
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
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'deposit-slip' &&
                            att.source === 'eta-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.depositSlip) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.depositSlip.name}</div>;
                          }
                          return null;
                        })()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={label}>Receipt</label>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={e => handleEtaPaymentChange(idx, "receipt", e)}
                          style={{ fontSize: "14px" }}
                        />
                        {(() => {
                          const uploadedFile = attachments.find(att =>
                            att.category === 'receipt' &&
                            att.source === 'eta-service' &&
                            att.paymentIndex === idx
                          );
                          if (uploadedFile) {
                            return (
                              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                                <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                              </div>
                            );
                          }
                          if (payment.receipt) {
                            return <div style={{ marginTop: 4, fontSize: "12px", color: "#059669" }}>✓ {payment.receipt.name}</div>;
                          }
                          return null;
                        })()}
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-1-attachment', 'passport-info');
                        setPassport1Attachment(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-1-attachment'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-1-attachment', 'passport-info'); setPassport1Attachment(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-1-visa', 'passport-info');
                        setPassport1Visa(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-1-visa'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-1-visa', 'passport-info'); setPassport1Visa(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-2-attachment', 'passport-info');
                        setPassport2Attachment(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-2-attachment'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-2-attachment', 'passport-info'); setPassport2Attachment(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-2-visa', 'passport-info');
                        setPassport2Visa(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-2-visa'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-2-visa', 'passport-info'); setPassport2Visa(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-3-attachment', 'passport-info');
                        setPassport3Attachment(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-3-attachment'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-3-attachment', 'passport-info'); setPassport3Attachment(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Visa</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'passport-3-visa', 'passport-info');
                        setPassport3Visa(file);
                      }
                    }}
                    style={{ fontSize: "14px" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att =>
                      att.category === 'other' &&
                      att.source === 'passport-info' &&
                      att.fileType === 'passport-3-visa'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button
                            type="button"
                            onClick={() => { handleGenericFileRemove(uploadedFile.file.id, 'passport-3-visa', 'passport-info'); setPassport3Visa(null); }}
                            style={{ fontSize: "14px", color: "#ef4444", background: "transparent", border: "1px solid #ef4444", borderRadius: "4px", padding: "2px 6px", cursor: "pointer" }}
                            title="Remove file"
                          >✕</button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Legacy Passport Files (uploaded before field tracking) */}
            {(() => {
              const currentClientId2 = clientId || tempClientId;
              const legacyPassportFiles = FileService.getLegacyFilesBySource(currentClientId2, 'passport-info');
              if (legacyPassportFiles.length === 0) return null;
              return (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '8px', border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#4338ca' }}>
                    📁 Previously Uploaded Passport Files ({legacyPassportFiles.length})
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#6366f1' }}>
                    Re-upload to the correct field above, then remove these.
                  </p>
                  {legacyPassportFiles.map(att => (
                    <div key={att.file.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#059669' }}>✓ {att.file.name}</span>
                      <R2DownloadButton r2Path={att.file.r2Path} className="" />
                      <button
                        type="button"
                        onClick={() => handleGenericFileRemove(att.file.id, 'legacy', 'passport-info')}
                        style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                        title="Remove file"
                      >✕</button>
                    </div>
                  ))}
                </div>
              );
            })()}

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

            {/* Booking/Tour Voucher Section */}
            <div style={{
              ...sectionStyle(windowWidth),
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'international-flight', 'booking-voucher');
                        setIntlFlight(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'international-flight'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'international-flight', 'booking-voucher');
                              setIntlFlight(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Local Flight 1 */}
                <div>
                  <label style={label}>🛩️ Local Flight 1</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'local-flight-1', 'booking-voucher');
                        setLocalFlight1(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'local-flight-1'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'local-flight-1', 'booking-voucher');
                              setLocalFlight1(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Local Flight 2 */}
                <div>
                  <label style={label}>🛩️ Local Flight 2</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'local-flight-2', 'booking-voucher');
                        setLocalFlight2(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'local-flight-2'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'local-flight-2', 'booking-voucher');
                              setLocalFlight2(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Local Flight 3 */}
                <div>
                  <label style={label}>🛩️ Local Flight 3</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'local-flight-3', 'booking-voucher');
                        setLocalFlight3(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'local-flight-3'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'local-flight-3', 'booking-voucher');
                              setLocalFlight3(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Local Flight 4 */}
                <div>
                  <label style={label}>🛩️ Local Flight 4</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'local-flight-4', 'booking-voucher');
                        setLocalFlight4(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'local-flight-4'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'local-flight-4', 'booking-voucher');
                              setLocalFlight4(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Hotel Voucher */}
                <div>
                  <label style={label}>🏨 Hotel Voucher</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'hotel-voucher', 'booking-voucher');
                        setHotelVoucher(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'hotel-voucher'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'hotel-voucher', 'booking-voucher');
                              setHotelVoucher(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>

                {/* Other Files */}
                <div>
                  <label style={label}>📄 Other Files</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleGenericFileUpload(file, 'other', 'other-files', 'booking-voucher');
                        setOtherFiles(file);
                      }
                    }}
                    style={{ fontSize: "14px", width: "100%" }}
                  />
                  {(() => {
                    const uploadedFile = attachments.find(att => 
                      att.category === 'other' && 
                      att.source === 'booking-voucher' &&
                      att.fileType === 'other-files'
                    );
                    if (uploadedFile) {
                      return (
                        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: "12px", color: "#059669" }}>
                            ✓ {uploadedFile.file.name}
                          </span>
                          <R2DownloadButton
                            r2Path={uploadedFile.file.r2Path}
                            className=""
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleGenericFileRemove(uploadedFile.file.id, 'other-files', 'booking-voucher');
                              setOtherFiles(null);
                            }}
                            style={{
                              fontSize: "14px",
                              color: "#ef4444",
                              background: "transparent",
                              border: "1px solid #ef4444",
                              borderRadius: "4px",
                              padding: "2px 6px",
                              cursor: "pointer"
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
                </div>
              </div>

              {/* Legacy Booking/Voucher Files (uploaded before field tracking) */}
              {(() => {
                const currentClientId = clientId || tempClientId;
                const legacyFiles = FileService.getLegacyFilesBySource(currentClientId, 'booking-voucher');
                if (legacyFiles.length === 0) return null;
                return (
                  <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', border: '1px dashed rgba(251, 191, 36, 0.4)' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                      📁 Previously Uploaded Files ({legacyFiles.length})
                    </p>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#a16207' }}>
                      These files were uploaded before field tracking was added. Please re-upload to the correct field above, then remove these.
                    </p>
                    {legacyFiles.map(att => (
                      <div key={att.file.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: '#059669' }}>✓ {att.file.name}</span>
                        <R2DownloadButton r2Path={att.file.r2Path} className="" />
                        <button
                          type="button"
                          onClick={() => handleGenericFileRemove(att.file.id, 'legacy', 'booking-voucher')}
                          style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                          title="Remove file"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Notes/Request/Endorsements Section */}
            <div style={{
              ...sectionStyle(windowWidth),
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
                  Notes/Request/Endorsements
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
                        <label style={label}>Agent/Officer</label>
                        <input
                          style={modernInput}
                          type="text"
                          placeholder="Enter agent/officer name"
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
                <button
                  type="button"
                  onClick={handleSaveRequestNotes}
                  style={{
                    background: "linear-gradient(135deg, #b45309 0%, #92400e 100%)",
                    color: "white",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "transform 0.2s",
                    boxShadow: "0 4px 12px rgba(180, 83, 9, 0.3)",
                    marginLeft: "12px"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-1px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  💾 Save Notes
                </button>
              </div>
            </div>

          </div>

          {/* Activity Log Section - Moved to Right Sidebar */}
          
          {/* File Attachments Section */}
          <div style={{ ...sectionStyle(windowWidth), marginTop: "24px" }}>
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
              onFileDeleted={() => {
                // console.log('File deleted:', fileId);
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
          </>
          )}
        </form>
      </div>

      {/* Right Sidebar - Activity Log - Hidden on mobile, shown on desktop */}
      {windowWidth >= 768 && (
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
      )}

      {/* Mobile Activity Log Floating Button */}
      {windowWidth < 768 && (
        <>
          {/* Floating Button */}
          <button
            onClick={() => setShowMobileActivityLog(!showMobileActivityLog)}
            style={{
              position: 'fixed',
              right: '20px',
              bottom: '20px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 40,
              transform: showMobileActivityLog ? 'scale(0.9)' : 'scale(1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.6)';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.transform = showMobileActivityLog ? 'scale(0.9)' : 'scale(1)';
            }}
            title="Toggle Activity Log"
          >
            📋
          </button>

          {/* Mobile Activity Log Modal */}
          {showMobileActivityLog && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'flex-end'
              }}
              onClick={() => setShowMobileActivityLog(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxHeight: '80vh',
                  backgroundColor: 'white',
                  borderRadius: '20px 20px 0 0',
                  boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.15)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: '16px',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white',
                    zIndex: 51
                  }}
                >
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', fontWeight: '600' }}>
                    Activity Log
                  </h3>
                  <button
                    onClick={() => setShowMobileActivityLog(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      color: '#6b7280'
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Content */}
                <div style={{ padding: '16px', flex: 1, overflowY: 'auto', width: '100%', minWidth: 0 }}>
                  {currentClientId ? (
                    <LogNoteComponent
                      key={logRefreshKey}
                      clientId={currentClientId}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                    />
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        color: '#7f8c8d',
                        padding: '40px 20px'
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '14px' }}>
                        Select a client to view activity log
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
};

interface MainPageProps {
  currentUser: { fullName: string; username: string; id: string; email: string };
  onUpdateUser?: (user: { fullName: string; username: string; id: string; email: string }) => void;
  navigationRequest?: {
    page: 'client-form' | 'activity-log' | 'log-notes';
    params?: any;
  } | null;
  onNavigationHandled?: () => void;
  isSidebarOpen?: boolean;
  onCloseSidebar?: () => void;
}

const MainPage: React.FC<MainPageProps> = ({ 
  currentUser, 
  onUpdateUser, 
  navigationRequest, 
  onNavigationHandled,
  isSidebarOpen = false,
  onCloseSidebar
}) => {
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
  const [viewDeleted, setViewDeleted] = useState(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewDeleted || false;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [viewActivityLog, setViewActivityLog] = useState(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewActivityLog || false;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [viewCalendar, setViewCalendar] = useState(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewCalendar || false;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [viewAdminPanel, setViewAdminPanel] = useState(() => {
    const saved = sessionStorage.getItem('crm_current_view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.viewAdminPanel || false;
      } catch {
        return false;
      }
    }
    return false;
  });

  // Get current user's profile image R2 path
  const getCurrentUserProfileImagePath = (): string | undefined => {
    const users = localStorage.getItem('crm_users');
    if (users) {
      try {
        const userList = JSON.parse(users);
        const user = userList.find((u: any) => u.fullName === currentUser.fullName);
        return user?.profileImageR2Path;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  // Handle navigation from notifications
  useEffect(() => {
    if (navigationRequest && onNavigationHandled) {
      const { page, params } = navigationRequest;
      
      if (page === 'log-notes' && params?.clientId) {
        // Navigate to client form (which shows log notes)
        setViewingForm({ clientId: params.clientId });
        setViewProfile(false);
        setViewDeleted(false);
        setViewActivityLog(false);
        setViewCalendar(false);
        setViewAdminPanel(false);
        
        // TODO: Scroll to specific note if params.scrollTo is provided
        // This would need to be handled in the ClientForm/LogNoteComponent
      } else if (page === 'activity-log') {
        setViewActivityLog(true);
        setViewingForm(null);
        setViewProfile(false);
        setViewDeleted(false);
        setViewCalendar(false);
        setViewAdminPanel(false);
      }
      
      onNavigationHandled();
    }
  }, [navigationRequest, onNavigationHandled]);

  // Save view state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('crm_current_view', JSON.stringify({
      viewingForm,
      viewProfile,
      viewDeleted,
      viewActivityLog,
      viewCalendar,
      viewAdminPanel
    }));
  }, [viewingForm, viewProfile, viewDeleted, viewActivityLog, viewCalendar, viewAdminPanel]);

  // Check if current user is admin
  const isAdmin = () => {
    // Check if user email is admin email as primary method
    if (currentUser.email && currentUser.email.toLowerCase() === 'admin@discovergrp.com') {
      return true;
    }
    
    // Check role field in crm_users as secondary method
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) {
      return false;
    }
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: any) => u.email === currentUser.email || u.fullName === currentUser.fullName);
      return user && user.role === 'admin';
    } catch (error) {
      return false;
    }
  };

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const allClients = await ClientService.searchClientsWithSync({
        searchTerm: searchQuery,
        status: statusFilter || undefined
      });
      setClients(allClients);
    } catch (error) {
      // console.error('Error loading clients:', error);
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
    window.addEventListener('sync:clients', handleClientUpdate);
    
    return () => {
      window.removeEventListener('clientDataUpdated', handleClientUpdate);
      window.removeEventListener('sync:clients', handleClientUpdate);
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
    setViewingForm(null);
    setViewProfile(false);
    setViewDeleted(false);
    setViewActivityLog(false);
    setViewAdminPanel(false);
    setViewCalendar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {viewingForm ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar 
            onNavigateToClientRecords={handleNavigateToClientRecords}
            onNavigateToProfile={() => {
              setViewingForm(null);
              setViewProfile(true);
            }}
            onNavigateToDeleted={() => {
              setViewingForm(null);
              setViewDeleted(true);
            }}
            onNavigateToActivityLog={() => {
              setViewingForm(null);
              setViewActivityLog(true);
            }}
            onNavigateToCalendar={() => {
              setViewingForm(null);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewingForm(null);
              setViewAdminPanel(true);
            } : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div
            className="main-content"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              backgroundColor: '#f5f5f5'
            }}>
            <ClientRecords
              onClientSelect={() => {}}
              onNavigateBack={() => setViewingForm(null)}
              clientId={viewingForm.clientId}
              currentUser={currentUser}
            />
          </div>
        </div>
      ) : viewProfile ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
            onNavigateToCalendar={() => {
              setViewProfile(false);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewProfile(false);
              setViewAdminPanel(true);
            } : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div
            className="main-content"
            style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: '#f5f5f5'
          }}>
            <UserProfile
              currentUser={currentUser}
              onBack={() => setViewProfile(false)}
              onUpdateUser={(userData) => {
                if (onUpdateUser) {
                  onUpdateUser({ 
                    fullName: userData.fullName, 
                    username: userData.username,
                    id: currentUser.id,
                    email: userData.email
                  });
                }
              }}
            />
          </div>
        </div>
      ) : viewDeleted ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
            onNavigateToCalendar={() => {
              setViewDeleted(false);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewDeleted(false);
              setViewAdminPanel(true);
            } : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div 
            className="main-content"
            style={{
            padding: '20px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
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
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
            onNavigateToCalendar={() => {
              setViewActivityLog(false);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewActivityLog(false);
              setViewAdminPanel(true);
            } : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div 
            className="main-content"
            style={{
            padding: '20px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: '#f5f5f5'
          }}>
            <ActivityLogViewer
              onBack={() => setViewActivityLog(false)}
            />
          </div>
        </div>
      ) : viewAdminPanel && isAdmin() ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
            onNavigateToCalendar={() => {
              setViewAdminPanel(false);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => setViewAdminPanel(true) : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div
            className="main-content"
            style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto'
          }}>
            <AdminPanel
              onBack={() => setViewAdminPanel(false)}
            />
          </div>
        </div>
      ) : viewCalendar ? (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar 
            onNavigateToClientRecords={() => {
              setViewCalendar(false);
              loadClients();
            }}
            onNavigateToProfile={() => {
              setViewCalendar(false);
              setViewProfile(true);
            }}
            onNavigateToDeleted={() => {
              setViewCalendar(false);
              setViewDeleted(true);
            }}
            onNavigateToActivityLog={() => {
              setViewCalendar(false);
              setViewActivityLog(true);
            }}
            onNavigateToCalendar={() => setViewCalendar(true)}
            onNavigateToAdminPanel={isAdmin() ? () => {
              setViewCalendar(false);
              setViewAdminPanel(true);
            } : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div
            className="main-content"
            style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            backgroundColor: '#f5f5f5'
          }}>
            <TeamCalendar
              currentUser={currentUser}
              onBack={() => setViewCalendar(false)}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <Sidebar 
            onNavigateToClientRecords={handleNavigateToClientRecords}
            onNavigateToProfile={() => setViewProfile(true)}
            onNavigateToDeleted={() => setViewDeleted(true)}
            onNavigateToActivityLog={() => setViewActivityLog(true)}
            onNavigateToCalendar={() => {
              setViewProfile(false);
              setViewDeleted(false);
              setViewActivityLog(false);
              setViewAdminPanel(false);
              setViewCalendar(true);
            }}
            onNavigateToAdminPanel={isAdmin() ? () => setViewAdminPanel(true) : undefined}
            isOpen={isSidebarOpen}
            onClose={onCloseSidebar}
          />
          <div
            className="main-content"
            style={{
            padding: '20px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
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
                            onClick={async (e) => {
                              e.stopPropagation();
                              const confirmed = await showConfirmDialog(
                                'Delete Client',
                                `Are you sure you want to delete client "${client.contactName}"? This can be recovered from the Deleted Clients page.`,
                                'error'
                              );
                              if (confirmed) {
                                const success = ClientService.deleteClient(client.id, currentUser.fullName);
                                if (success) {
                                  ActivityLogService.addLog({
                                    clientId: client.id,
                                    clientName: client.contactName || 'Unknown',
                                    action: 'deleted',
                                    performedBy: currentUser.fullName,
                                    profileImageR2Path: getCurrentUserProfileImagePath(),
                                    performedByUser: currentUser.fullName,
                                    details: `Client moved to trash`
                                  });
                                  showSuccessToast('Client moved to trash. You can recover it from Deleted Clients page.');
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
    </div>
  );
};

export default MainPage;