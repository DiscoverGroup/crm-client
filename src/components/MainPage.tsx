import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeName, sanitizeEmail, sanitizePhone, sanitizeText, containsAttackPatterns } from '../utils/formSanitizer';
import { ClientService, type ClientData } from '../services/clientService';
import { PaymentService, type PaymentData } from "../payments/paymentService";
import type { PaymentDetail } from "../types/payment";
import { FileService, type FileAttachment } from '../services/fileService';
import { useFieldTracking } from '../hooks/useFieldTracking';
import { useSectionTracking } from '../hooks/useSectionTracking';
import LogNoteComponent from './LogNoteComponent';
import NotesThreadComponent from './NotesThreadComponent';
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
const modernInput: React.CSSProperties = {
  padding: "11px 14px",
  border: "1.5px solid #d1dbe8",
  borderRadius: "10px",
  fontSize: "15px",
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#ffffff",
  transition: "all 0.2s ease",
  color: "#1e293b",
  fontFamily: "'Poppins', sans-serif"
};

// modernInputFocus removed because it was unused

const modernCheckbox = {
  width: "18px",
  height: "18px",
  accentColor: "#28A2DC",
  transform: "scale(1.2)",
  cursor: "pointer"
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 16px",
  background: "#f8fafc",
  borderRadius: "8px",
  border: "1.5px solid #e2e8f0",
  cursor: "pointer",
  transition: "all 0.2s ease",
  fontWeight: 500,
  color: "#1e293b"
};

const sectionStyle = (w: number): React.CSSProperties => ({
  background: "#ffffff",
  borderRadius: "16px",
  boxShadow: "0 2px 12px rgba(10, 45, 116, 0.08), 0 1px 3px rgba(0,0,0,0.04)",
  padding: w < 640 ? "16px" : w <= 1366 ? "20px" : "28px",
  marginBottom: w < 640 ? "16px" : w <= 1366 ? "16px" : "24px",
  border: "1px solid rgba(10, 45, 116, 0.1)",
  position: "relative" as const,
  overflow: "hidden" as const
});

const sectionHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  marginBottom: "20px",
  paddingBottom: "14px",
  borderBottom: "2px solid rgba(40, 162, 220, 0.25)"
};

const label: React.CSSProperties = {
  fontWeight: 600,
  color: "#0A2D74",
  marginBottom: "6px",
  display: "block",
  fontSize: "13px",
  letterSpacing: "0.02em",
  textTransform: "uppercase" as const
};

const subLabel = {
  fontWeight: 500,
  color: "#64748b",
  fontSize: "12px",
  marginTop: "3px",
  fontStyle: "italic"
};

const saveButtonStyle = (isSaving: boolean): React.CSSProperties => ({
  background: isSaving
    ? "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)"
    : "linear-gradient(135deg, #0A2D74 0%, #1a4a9e 60%, #28A2DC 100%)",
  color: "#fff",
  padding: "10px 24px",
  border: "none",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: isSaving ? "not-allowed" : "pointer",
  boxShadow: isSaving
    ? "none"
    : "0 4px 14px rgba(10, 45, 116, 0.35)",
  transition: "all 0.25s ease",
  marginTop: "20px",
  letterSpacing: "0.02em",
  opacity: isSaving ? 0.7 : 1
});

// ─── File upload security ───────────────────────────────────────────────────
const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const UPLOAD_ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'image/bmp', 'image/tiff', 'image/svg+xml', 'image/heic', 'image/heif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
]);
function validateUploadFile(file: File): string | null {
  if (file.size > UPLOAD_MAX_BYTES) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return `File is too large (${sizeMB} MB). Maximum allowed size is 10 MB.`;
  }
  if (!UPLOAD_ALLOWED_TYPES.has(file.type))
    return 'Invalid file type. Only images (JPEG, PNG, GIF, WebP, BMP, TIFF, SVG, HEIC), PDF, and Word documents (.doc, .docx) are allowed.';
  return null;
}

const paymentOptions = [
  { value: "full_cash", label: "Full Cash (1 time payment)", terms: 1 },
  { value: "installment", label: "Installment (up to 20 terms)", terms: 20 },
  { value: "down_payment", label: "Down Payment (2 time payment)", terms: 2 }
];

// Companion type with extra fields
type Companion = {
  firstName: string;
  lastName: string;
  dob: string;
  email: string;
  contactNo: string;
};

// Full featured ClientRecords form component
const ClientRecords: React.FC<{
  onClientSelect?: () => void;
  onNavigateBack?: () => void;
  clientId?: string;
  currentUser?: { fullName: string; username: string; id?: string; email?: string };
  onClientIdResolved?: (realClientId: string) => void;
}> = ({ onNavigateBack, clientId, currentUser: propsCurrentUser, onClientIdResolved }) => {
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
  const [numberOfPax, setNumberOfPax] = useState<number>(0);
  const [bookingConfirmations, setBookingConfirmations] = useState<string[]>([""]);
  
  // Generate temporary client ID for new clients
  const [tempClientId] = useState(() => clientId || `temp_${Date.now()}`);
  const [packageLink, setPackageLink] = useState("");
  const [clientRequest, setClientRequest] = useState("");
  
  // Resolved client ID — updated to the real CLT-xxx after first save of a new client
  const [resolvedClientId, setResolvedClientId] = useState<string | undefined>(clientId);

  // Log refresh state
  const [logRefreshKey, setLogRefreshKey] = useState(0);
  const [bottomPanelTab, setBottomPanelTab] = useState<'activity' | 'notes'>('activity');
  
  // Incremented when sync:clients fires so the form reloads fresh data
  const [clientDataVersion, setClientDataVersion] = useState(0);
  

  
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
  useFieldTracking({
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
          setNumberOfPax(existingClient.numberOfPax || 0);
          setBookingConfirmations(
            Array.isArray(existingClient.bookingConfirmations)
              ? existingClient.bookingConfirmations
              : existingClient.bookingConfirmation
                ? [existingClient.bookingConfirmation]
                : [""]
          );
          setPackageLink(existingClient.packageLink || '');
          setClientRequest(existingClient.clientRequest || '');
          if (existingClient.companions) {
            // Backward-compat: old records may have { name, address, occupation }
            setCompanions(existingClient.companions.map((c: any) => ({
              firstName: c.firstName || c.name || '',
              lastName: c.lastName || '',
              dob: c.dob || '',
              email: c.email || '',
              contactNo: c.contactNo || '',
            })));
          }
          // Sync passportNames with loaded pax count
          const paxCount = existingClient.numberOfPax || 1;
          setPassportNames(Array.from({ length: paxCount }, (_, i) =>
            (existingClient.passportNames || [])[i] || ''
          ));
          // Visa & embassy fields
          setVisaService(existingClient.visaService || false);
          setInsuranceService(existingClient.insuranceService || false);
          setEta(existingClient.etaService || false);
          setEmbassyName(existingClient.embassyName || '');
          setEmbassyAddress(existingClient.embassyAddress || '');
          setVisaOfficerAppointed(existingClient.visaOfficerAppointed || '');
          // Account Relations
          setArm(existingClient.arm || '');
          setAfterSalesSCDate(existingClient.afterSalesSCDate || '');
          setAfterSalesSCReport(existingClient.afterSalesSCReport || '');
          setAfterSalesSCReportBy(existingClient.afterSalesSCReportBy || '');
          // Visa SC Reports
          setAfterVisaSCDate(existingClient.afterVisaSCDate || '');
          setAfterVisaSCReport(existingClient.afterVisaSCReport || '');
          setAfterVisaSCReportBy(existingClient.afterVisaSCReportBy || '');
          setPreDepartureSCDate(existingClient.preDepartureSCDate || '');
          setPreDepartureSCReport(existingClient.preDepartureSCReport || '');
          setPreDepartureSCReportBy(existingClient.preDepartureSCReportBy || '');
          setPostDepartureSCDate(existingClient.postDepartureSCDate || '');
          setPostDepartureSCReport(existingClient.postDepartureSCReport || '');
          setPostDepartureSCReportBy(existingClient.postDepartureSCReportBy || '');

          // Load booking voucher links
          const vl = existingClient.bookingVoucherLinks || {};
          setVoucherLinkIntlFlight(vl.intlFlight || '');
          // Migrate legacy localFlight1-4 into localFlights array
          const migratedFlights: string[] = vl.localFlights && vl.localFlights.length > 0
            ? vl.localFlights
            : [vl.localFlight1 || '', vl.localFlight2 || '', vl.localFlight3 || '', vl.localFlight4 || ''].filter(l => l !== '');
          setLocalFlightLinks(migratedFlights.length > 0 ? migratedFlights : ['']);
          setLocalFlightFiles(Array(Math.max(migratedFlights.length, 1)).fill(null));
          setVoucherLinkTourVoucher(vl.tourVoucher || '');
          setVoucherLinkHotelVoucher(vl.hotelVoucher || '');
          setVoucherLinkOtherFiles(vl.otherFiles || '');

          // Load travel fund data
          const clientAny = existingClient as any;
          setTravelFundRequestDate(clientAny.travelFundRequestDate || '');
          setTravelFundApprovalDate(clientAny.travelFundApprovalDate || '');
          setTravelFundReleasedAmount(clientAny.travelFundReleasedAmount || '');
          setTravelFundTotalAmount(clientAny.travelFundTotalAmount || '');
          if (Array.isArray(clientAny.travelFundPayments) && clientAny.travelFundPayments.length > 0) {
            setTravelFundPayments(clientAny.travelFundPayments);
          }

          // Load saved payment data for existing client
          const savedPayment = PaymentService.getPaymentData(clientId);
          if (savedPayment) {
            if (savedPayment.paymentTerm) {
              // Migrate legacy "travel_funds" payment term
              const term = savedPayment.paymentTerm === 'travel_funds' ? 'full_cash' : savedPayment.paymentTerm as string;
              setPaymentTerm(term);
            }
            if (typeof savedPayment.termCount === 'number') setTermCount(savedPayment.termCount);
            if ((savedPayment as any).totalAmount) setTotalAmount((savedPayment as any).totalAmount);
            if (savedPayment.selectedPaymentBox !== undefined) setSelectedPaymentBox(savedPayment.selectedPaymentBox as number | null);
            if (Array.isArray(savedPayment.paymentDetails)) {
              setPaymentDetails(savedPayment.paymentDetails.map((d: any) => ({
                dueDate: (d.dueDate as string) || '',
                date: (d.date as string) || '',
                completed: !!(d.completed),
                amount: (d.amount as string) || '',
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
    if (value === "Rebook" && bookingConfirmations.length < 2) {
      setBookingConfirmations(prev => [...prev, ""]);
    }
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
    // Auto-resize companions to (pax - 1)
    const targetCount = Math.max(0, value - 1);
    setCompanions(prev => {
      if (prev.length === targetCount) return prev;
      if (prev.length < targetCount) {
        const extra = Array.from({ length: targetCount - prev.length }, () => ({
          firstName: "", lastName: "", dob: "", email: "", contactNo: ""
        }));
        return [...prev, ...extra];
      }
      return prev.slice(0, targetCount);
    });
    // Auto-resize passport name slots to match pax count
    setPassportNames(prev => {
      if (prev.length === value) return prev;
      if (prev.length < value) {
        const extra = Array.from({ length: value - prev.length }, () => "");
        return [...prev, ...extra];
      }
      return prev.slice(0, value);
    });
  };
  
  const [bcTooltipVisible, setBcTooltipVisible] = useState(false);
  const [bcTooltipPos, setBcTooltipPos] = useState({ x: 0, y: 0 });

  const handleBookingConfirmationFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateUploadFile(file);
    if (validationError) {
      showErrorToast(validationError);
      e.target.value = '';
      return;
    }
    await handleGenericFileUpload(file, 'other', `booking-confirmation-${index + 1}`, 'booking-confirmation');
    const updated = [...bookingConfirmations];
    updated[index] = file.name;
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
  const [termCount, setTermCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState("");
  const [selectedPaymentBox, setSelectedPaymentBox] = useState<number | null>(null);
  const [paymentModalIdx, setPaymentModalIdx] = useState<number | null>(null);
  const [companionModalIdx, setCompanionModalIdx] = useState<number | null>(null);
  const [customMaxTerms, setCustomMaxTerms] = useState<number | null>(null);
  const [isEditingMaxTerms, setIsEditingMaxTerms] = useState(false);
  const [customMaxTermsInput, setCustomMaxTermsInput] = useState("");

  // Companions
  const [companions, setCompanions] = useState<Companion[]>([]);

  // Payment Details Table for terms
  const initialPaymentCount = paymentOptions[0].value === "installment" ? termCount : paymentOptions[0].terms;
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>(
    Array.from({ length: initialPaymentCount }, () => ({ dueDate: "", date: "", completed: false, amount: "", depositSlip: null, receipt: null }))
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
  
  // Passport names — one per pax (dynamic)
  const [passportNames, setPassportNames] = useState<string[]>([""]);
  
  // Embassy information
  const [embassyName, setEmbassyName] = useState("");
  const [embassyAddress, setEmbassyAddress] = useState("");
  // Visa Officer
  const [visaOfficerAppointed, setVisaOfficerAppointed] = useState("");
  const [isSavingVisa, setIsSavingVisa] = useState(false);
  const [isSavingEmbassy, setIsSavingEmbassy] = useState(false);
  // Account Relations
  const [arm, setArm] = useState("");
  const [afterSalesSCDate, setAfterSalesSCDate] = useState("");
  const [afterSalesSCReport, setAfterSalesSCReport] = useState("");
  const [afterSalesSCReportBy, setAfterSalesSCReportBy] = useState("");
  const [isSavingAccountRelations, setIsSavingAccountRelations] = useState(false);
  const [isSavingAfterSalesSC, setIsSavingAfterSalesSC] = useState(false);
  const [isSavingAfterVisaSC, setIsSavingAfterVisaSC] = useState(false);
  const [isSavingPreDepartureSC, setIsSavingPreDepartureSC] = useState(false);
  const [isSavingPostDepartureSC, setIsSavingPostDepartureSC] = useState(false);
  // Visa SC Reports
  const [afterVisaSCDate, setAfterVisaSCDate] = useState("");
  const [afterVisaSCReport, setAfterVisaSCReport] = useState("");
  const [afterVisaSCReportBy, setAfterVisaSCReportBy] = useState("");
  const [preDepartureSCDate, setPreDepartureSCDate] = useState("");
  const [preDepartureSCReport, setPreDepartureSCReport] = useState("");
  const [preDepartureSCReportBy, setPreDepartureSCReportBy] = useState("");
  const [postDepartureSCDate, setPostDepartureSCDate] = useState("");
  const [postDepartureSCReport, setPostDepartureSCReport] = useState("");
  const [postDepartureSCReportBy, setPostDepartureSCReportBy] = useState("");

  // Travel Funds workflow states
  const [travelFundRequestDate, setTravelFundRequestDate] = useState("");
  const [travelFundApprovalDate, setTravelFundApprovalDate] = useState("");
  const [travelFundReleasedAmount, setTravelFundReleasedAmount] = useState("");
  const [travelFundTotalAmount, setTravelFundTotalAmount] = useState("");
  const [travelFundPayments, setTravelFundPayments] = useState<{ date: string; amount: string }[]>([{ date: "", amount: "" }]);

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
  const [_localFlightFiles, setLocalFlightFiles] = useState<(File | null)[]>([null]);
  const [_tourVoucher, setTourVoucher] = useState<File | null>(null);
  const [_hotelVoucher, setHotelVoucher] = useState<File | null>(null);
  const [_otherFiles, setOtherFiles] = useState<File | null>(null);

  // Booking/Voucher attachment link states
  const [voucherLinkIntlFlight, setVoucherLinkIntlFlight] = useState('');
  const [localFlightLinks, setLocalFlightLinks] = useState<string[]>(['']);
  const [voucherLinkTourVoucher, setVoucherLinkTourVoucher] = useState('');
  const [voucherLinkHotelVoucher, setVoucherLinkHotelVoucher] = useState('');
  const [voucherLinkOtherFiles, setVoucherLinkOtherFiles] = useState('');

  // File attachment state
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // PaymentTerm-driven behavior
  const currentOption = paymentOptions.find(opt => opt.value === paymentTerm) ?? paymentOptions[0];
  const showTermCount = paymentTerm === "installment";
  const paymentBoxes = Array.from({ length: currentOption.value === "installment" ? termCount : currentOption.terms }, (_, i) => i + 1);

  // Sync paymentDetails rows with actual payment box count (handles full_cash, down_payment, installment)
  const actualPaymentCount = currentOption.value === "installment" ? termCount : currentOption.terms;
  useEffect(() => {
    setPaymentDetails(prev => {
      const next = [...prev];
      if (next.length < actualPaymentCount) {
        for (let i = next.length; i < actualPaymentCount; i++) next.push({ dueDate: "", date: "", completed: false, amount: "", depositSlip: null, receipt: null });
      } else if (next.length > actualPaymentCount) {
        next.length = actualPaymentCount;
      }
      return next;
    });
  }, [actualPaymentCount]);

  // Load file attachments
  useEffect(() => {
    const loadAttachments = () => {
      try {
        const currentClientId = clientId || tempClientId;
        if (currentClientId) {
          // Load attachments for specific client (real or temp)
          const clientAttachments = FileService.getFilesByClient(currentClientId);
          setAttachments(clientAttachments);

          // Ensure bookingConfirmations has enough slots for every uploaded booking-confirmation file
          const bcFiles = clientAttachments.filter(att => att.source === 'booking-confirmation');
          if (bcFiles.length > 0) {
            const maxIdx = bcFiles.reduce((max, att) => {
              const m = att.fileType?.match(/booking-confirmation-(\d+)/);
              return m ? Math.max(max, parseInt(m[1])) : max;
            }, 0);
            if (maxIdx > 0) {
              setBookingConfirmations(prev => {
                if (prev.length >= maxIdx) return prev;
                const extended = [...prev];
                while (extended.length < maxIdx) extended.push('');
                return extended;
              });
            }
          }
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
    field: "dueDate" | "date" | "completed" | "depositSlip" | "receipt" | "amount",
    value: string | boolean | React.ChangeEvent<HTMLInputElement>
  ) => {
    if (field === "dueDate" || field === "date") {
      setPaymentDetails(pd =>
        pd.map((row, i) => {
          if (i !== idx) return row;
          return { ...row, [field]: value as string };
        })
      );
      return;
    }
    if (field === "amount") {
      const sanitized = (value as string).replace(/[^0-9.,]/g, '');
      setPaymentDetails(pd =>
        pd.map((row, i) => i === idx ? { ...row, amount: sanitized } : row)
      );
      return;
    }
    if (field === "completed") {
      setPaymentDetails(pd =>
        pd.map((row, i) => i === idx ? { ...row, completed: value as boolean } : row)
      );
      return;
    }

    const event = value as React.ChangeEvent<HTMLInputElement>;
    const file = event?.target?.files?.[0];
    
    if (file) {
      // Validation: File size and type
      const validationError = validateUploadFile(file);
      if (validationError) {
        showErrorToast(validationError);
        event.target.value = '';
        return;
      }

      try {
        // Save file to FileService with client ID
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
      // Validation: File size and type
      const validationError = validateUploadFile(file);
      if (validationError) {
        showErrorToast(validationError);
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
        totalAmount,
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
        clientRequest: sanitizeText(clientRequest || '', 2000),
        companions: companions,
        travelFundRequestDate,
        travelFundApprovalDate,
        travelFundReleasedAmount: travelFundReleasedAmount.replace(/[^0-9.,]/g, '').slice(0, 50),
        travelFundTotalAmount: travelFundTotalAmount.replace(/[^0-9.,]/g, '').slice(0, 50),
        travelFundPayments: travelFundPayments.map(p => ({ date: p.date, amount: p.amount.replace(/[^0-9.,]/g, '').slice(0, 50) })),
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
        // Migrate log notes from temp ID to real client ID in MongoDB
        const token = localStorage.getItem('crm_auth_token');
        if (token) {
          fetch('/.netlify/functions/database', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection: 'log_notes',
              operation: 'updateMany',
              filter: { clientId: tempClientId },
              update: { clientId: savedClientId }
            })
          }).catch(() => {});
        }
        // Refresh attachments with new client ID
        const clientAttachments = FileService.getFilesByClient(savedClientId);
        setAttachments(clientAttachments);
        // Notify parent so viewingForm gets the real client ID
        onClientIdResolved?.(savedClientId);
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
        firstName: sanitizeName(c.firstName, 200),
        lastName: sanitizeName(c.lastName, 200),
        email: sanitizeEmail(c.email || ''),
        contactNo: sanitizePhone(c.contactNo || ''),
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
        clientRequest: sanitizeText(clientRequest || '', 2000),
        companions: cleanCompanions,
        passportNames,
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

  const handleSaveAccountRelations = async () => {
    setIsSavingAccountRelations(true);
    try {
      if (!currentClientId) {
        showWarningToast('Please save client information first before saving account relations.');
        return;
      }
      await ClientService.updateClient(currentClientId, {
        arm,
      });
      saveSection('account-relations', 'Account Relations');
      showSuccessToast('Account relations saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving account relations.');
    } finally {
      setIsSavingAccountRelations(false);
    }
  };

  const handleSaveAfterSalesSC = async () => {
    setIsSavingAfterSalesSC(true);
    try {
      if (!currentClientId) { showWarningToast('Please save client information first.'); return; }
      await ClientService.updateClient(currentClientId, { afterSalesSCDate, afterSalesSCReport, afterSalesSCReportBy });
      saveSection('after-sales-sc', 'After Sales SC');
      showSuccessToast('After Sales SC saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving After Sales SC.');
    } finally {
      setIsSavingAfterSalesSC(false);
    }
  };

  const handleSaveAfterVisaSC = async () => {
    setIsSavingAfterVisaSC(true);
    try {
      if (!currentClientId) { showWarningToast('Please save client information first.'); return; }
      await ClientService.updateClient(currentClientId, { afterVisaSCDate, afterVisaSCReport, afterVisaSCReportBy });
      saveSection('after-visa-sc', 'After Visa SC');
      showSuccessToast('After Visa SC saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving After Visa SC.');
    } finally {
      setIsSavingAfterVisaSC(false);
    }
  };

  const handleSavePreDepartureSC = async () => {
    setIsSavingPreDepartureSC(true);
    try {
      if (!currentClientId) {
        showWarningToast('Please save client information first.');
        return;
      }
      await ClientService.updateClient(currentClientId, {
        preDepartureSCDate,
        preDepartureSCReport,
        preDepartureSCReportBy,
      });
      saveSection('pre-departure-sc', 'Pre-Departure SC');
      showSuccessToast('Pre-Departure SC saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving Pre-Departure SC.');
    } finally {
      setIsSavingPreDepartureSC(false);
    }
  };

  const handleSavePostDepartureSC = async () => {
    setIsSavingPostDepartureSC(true);
    try {
      if (!currentClientId) {
        showWarningToast('Please save client information first.');
        return;
      }
      await ClientService.updateClient(currentClientId, {
        postDepartureSCDate,
        postDepartureSCReport,
        postDepartureSCReportBy,
      });
      saveSection('post-departure-sc', 'Post-Departure SC');
      showSuccessToast('Post-Departure SC saved successfully!');
    } catch (error) {
      showErrorToast('An error occurred while saving Post-Departure SC.');
    } finally {
      setIsSavingPostDepartureSC(false);
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
        visaOfficerAppointed,
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
        embassyName,
        embassyAddress,
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

  // Auto-save voucher links to cloud when a link field loses focus
  const saveVoucherLinks = async (overrides?: Partial<{
    intlFlight: string; localFlights: string[]; tourVoucher: string; hotelVoucher: string; otherFiles: string;
  }>) => {
    if (!currentClientId || currentClientId.startsWith('temp_')) return;
    try {
      await ClientService.updateClient(currentClientId, {
        bookingVoucherLinks: {
          intlFlight: overrides?.intlFlight ?? voucherLinkIntlFlight,
          localFlights: overrides?.localFlights ?? localFlightLinks,
          tourVoucher: overrides?.tourVoucher ?? voucherLinkTourVoucher,
          hotelVoucher: overrides?.hotelVoucher ?? voucherLinkHotelVoucher,
          otherFiles: overrides?.otherFiles ?? voucherLinkOtherFiles,
        },
      });
    } catch { /* non-fatal */ }
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
      const validationError = validateUploadFile(file);
      if (validationError) {
        showErrorToast(validationError);
        event.target.value = '';
        return;
      }
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
      const validationError = validateUploadFile(file);
      if (validationError) {
        showErrorToast(validationError);
        event.target.value = '';
        return;
      }
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
      const validationError = validateUploadFile(file);
      if (validationError) {
        showErrorToast(validationError);
        event.target.value = '';
        return;
      }
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



  // Handlers
  function handleCompanionChange(idx: number, field: keyof Companion, value: string) {
    setCompanions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  function handlePaymentTermChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    trackSectionField('payment-terms-schedule', 'paymentTerm', selected, 'Payment Terms');
    setPaymentTerm(selected);
    const opt = paymentOptions.find(o => o.value === selected)!;
    setCustomMaxTerms(null);
    setIsEditingMaxTerms(false);
    if (selected === "installment") {
      setTermCount(0); // start at 0, let user choose
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
      background: "transparent",
      position: 'relative'
    }}>
      <div style={{
        maxWidth: 1400,
        margin: windowWidth <= 1366 ? "16px auto" : "40px auto",
        padding: windowWidth <= 1366 ? "0 12px" : "0 20px",
        display: 'flex',
        gap: windowWidth <= 1366 ? '16px' : '24px',
        alignItems: 'flex-start',
        position: 'relative'
      }}>
        {/* Main Content - Left Side */}
        <div style={{
          flex: 1,
          background: "transparent"
        }}>
          <form style={{ padding: 24 }} autoComplete="off">
          {isLoadingClients ? (
            <Loader message="Loading client information..." />
          ) : (
          <>
          {/* Header */}
          <div style={{ 
            background: "linear-gradient(135deg, #0A2D74 0%, #1a4a9e 60%, #28A2DC 100%)",
            borderRadius: "16px",
            padding: windowWidth < 640 ? "16px" : windowWidth <= 1366 ? "16px 20px" : "28px",
            marginBottom: windowWidth <= 1366 ? "16px" : "24px",
            boxShadow: "0 8px 32px rgba(10, 45, 116, 0.3)",
            border: "none",
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
              background: 'rgba(255,255,255,0.08)',
              borderRadius: '50%',
              zIndex: 0
            }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: windowWidth < 640 ? '8px' : '12px' }}>
                
                <h1 style={{ 
                  margin: 0, 
                  fontSize: windowWidth < 640 ? '20px' : '26px', 
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "0.06em",
                  fontFamily: "'Poppins', sans-serif",
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
                padding: windowWidth < 640 ? '9px 14px' : '10px 20px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: windowWidth < 640 ? '12px' : '13px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                width: windowWidth < 640 ? '100%' : 'auto',
                whiteSpace: 'nowrap',
                backdropFilter: 'blur(10px)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'; }}
            >
              ← Back to Dashboard
            </button>
          </div>
          
          {/* Client Info */}
          <div style={sectionStyle(windowWidth)}>
            {/* Section Header */}
            <div style={sectionHeader}>
              
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
                <label style={label}>Sales Agent</label>
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
            {/* Travel Funds Details — shown when status is "Travel Funds" */}
            {status === "Travel Funds" && (
              <div style={{ marginTop: 18, padding: 20, background: "linear-gradient(145deg, rgba(236,253,245,0.9) 0%, rgba(209,250,229,0.7) 100%)", borderRadius: 12, border: "1px solid rgba(16,185,129,0.3)" }}>
                <h4 style={{ margin: "0 0 16px", color: "#065f46", fontSize: "15px", fontWeight: 600 }}>Travel Fund Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                  <div>
                    <label style={label}>Request Date</label>
                    <input style={modernInput} type="date" value={travelFundRequestDate} onChange={e => setTravelFundRequestDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={label}>Approval Date</label>
                    <input style={modernInput} type="date" value={travelFundApprovalDate} onChange={e => setTravelFundApprovalDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={label}>Approved Amount</label>
                    <input style={modernInput} type="text" placeholder="Enter approved amount" value={travelFundReleasedAmount} onChange={e => setTravelFundReleasedAmount(e.target.value.replace(/[^0-9.,]/g, ''))} />
                  </div>
                </div>

                {/* Travel Fund Total Amount & Payments */}
                <div style={{ marginTop: 16 }}>
                  <label style={label}>Total Amount</label>
                  <input
                    style={modernInput}
                    type="text"
                    placeholder="Enter total amount"
                    value={travelFundTotalAmount}
                    onChange={e => setTravelFundTotalAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
                  />
                </div>

                {/* Payment entries */}
                <div style={{ marginTop: 16 }}>
                  <label style={label}>Payments</label>
                  {travelFundPayments.map((payment, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", marginTop: idx === 0 ? 6 : 8 }}>
                      <div style={{ flex: 1 }}>
                        <input
                          style={modernInput}
                          type="date"
                          value={payment.date}
                          onChange={e => {
                            const updated = [...travelFundPayments];
                            updated[idx] = { ...updated[idx], date: e.target.value };
                            setTravelFundPayments(updated);
                          }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <input
                          style={modernInput}
                          type="text"
                          placeholder="Amount"
                          value={payment.amount}
                          onChange={e => {
                            const updated = [...travelFundPayments];
                            updated[idx] = { ...updated[idx], amount: e.target.value.replace(/[^0-9.,]/g, '') };
                            setTravelFundPayments(updated);
                          }}
                        />
                      </div>
                      {travelFundPayments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setTravelFundPayments(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTravelFundPayments(prev => [...prev, { date: "", amount: "" }])}
                    style={{ marginTop: 8, fontSize: 13, color: "#059669", background: "transparent", border: "1px dashed #059669", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontWeight: 600 }}
                  >+ Add Payment</button>
                </div>

                {/* Travel Fund Balance Summary */}
                {travelFundTotalAmount && (
                  (() => {
                    const total = parseFloat(travelFundTotalAmount.replace(/,/g, '')) || 0;
                    const paid = travelFundPayments.reduce((sum, p) => sum + (parseFloat((p.amount || '').replace(/,/g, '')) || 0), 0);
                    const remaining = total - paid;
                    return (
                      <div style={{ marginTop: 16, padding: "14px 18px", background: "rgba(255,255,255,0.7)", borderRadius: 10, border: "1px solid rgba(16,185,129,0.25)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 14 }}>
                          <div>
                            <span style={{ color: "#065f46", fontWeight: 500 }}>Total Amount: </span>
                            <span style={{ color: "#1e293b", fontWeight: 700 }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span style={{ color: "#065f46", fontWeight: 500 }}>Total Paid: </span>
                            <span style={{ color: "#059669", fontWeight: 700 }}>{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span style={{ color: "#065f46", fontWeight: 500 }}>Remaining Balance: </span>
                            <span style={{ color: remaining > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}
            {/* Save Button */}
            <div style={{ display: "flex", flexDirection: windowWidth < 640 ? 'column' : 'row', justifyContent: "flex-end", marginTop: 16, gap: '12px', alignItems: windowWidth < 640 ? 'stretch' : 'center' }}>
              <span style={{ fontSize: windowWidth < 640 ? '12px' : '13px', color: '#dc2626', fontWeight: '500', order: windowWidth < 640 ? 2 : 0 }}>
                Remember to save changes before leaving!
              </span>
              <button
                type="button"
                onClick={handleSaveClientInfo}
                disabled={isSavingClient}
                style={{ ...saveButtonStyle(isSavingClient), width: windowWidth < 640 ? '100%' : 'auto' }}
              >
                {isSavingClient ? "Saving..." : "Save Client Info"}
              </button>
            </div>
          </div>

          {/* Package & Companions */}
          <div style={sectionStyle(windowWidth)}>
            {/* Section Header */}
            <div style={sectionHeader}>
              
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
                  min={0}
                  value={numberOfPax}
                  onChange={e => setNumberOfPaxTracked(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            {/* Booking Confirmation — full-width */}
            <div className="form-row" style={{ marginTop: 18 }}>
              <div className="form-field" style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={label}>Booking Confirmation</label>
                  {/* Tooltip icon */}
                  <span
                    style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setBcTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
                      setBcTooltipVisible(true);
                    }}
                    onMouseLeave={() => setBcTooltipVisible(false)}
                  >
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: "#3b82f6",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "default",
                      userSelect: "none",
                      lineHeight: 1,
                    }}>?</span>
                    {bcTooltipVisible && createPortal(
                      <span style={{
                        position: "fixed",
                        top: bcTooltipPos.y,
                        left: bcTooltipPos.x,
                        transform: "translateX(-50%)",
                        background: "#1e293b",
                        color: "#fff",
                        fontSize: 14,
                        fontWeight: 500,
                        padding: "8px 14px",
                        borderRadius: 8,
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                        zIndex: 99999,
                        pointerEvents: "none",
                      }}>
                        Booking confirmation must be filled
                        <span style={{
                          position: "absolute",
                          bottom: "100%",
                          left: "50%",
                          transform: "translateX(-50%)",
                          border: "6px solid transparent",
                          borderBottomColor: "#1e293b",
                        }} />
                      </span>,
                      document.body
                    )}
                  </span>
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
                {bookingConfirmations.map((_bc, idx) => {
                  const uploadedFile = attachments.find(att =>
                    att.category === 'other' &&
                    att.source === 'booking-confirmation' &&
                    att.fileType === `booking-confirmation-${idx + 1}`
                  );
                  return (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: idx > 0 ? 8 : 4 }}>
                      <div style={{ flex: 1 }}>
                        {uploadedFile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(5,150,105,0.07)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.25)' }}>
                            <span style={{ fontSize: 13, color: '#059669', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ✓ {uploadedFile.file.name}
                            </span>
                            <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                            <button
                              type="button"
                              onClick={() => {
                                handleGenericFileRemove(uploadedFile.file.id, `booking-confirmation-${idx + 1}`, 'booking-confirmation');
                                const updated = [...bookingConfirmations];
                                updated[idx] = '';
                                setBookingConfirmations(updated);
                              }}
                              style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              title="Remove file"
                            >✕ Remove</button>
                          </div>
                        ) : (
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 16px',
                            border: '2px dashed rgba(147,197,253,0.6)',
                            borderRadius: 12,
                            background: 'rgba(239,246,255,0.7)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            userSelect: 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(147,197,253,0.6)')}
                          >
                            <span style={{ fontSize: 20 }}>📎</span>
                            <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 600 }}>
                              Choose file to upload
                            </span>
                            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
                              PDF, DOCX, Image (max 10 MB)
                            </span>
                            <input
                              type="file"
                              accept="image/*,.pdf,.doc,.docx"
                              onChange={e => handleBookingConfirmationFileUpload(idx, e)}
                              style={{ display: 'none' }}
                            />
                          </label>
                        )}
                      </div>
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
                            padding: 0,
                            flexShrink: 0,
                          }}
                          title="Remove this booking confirmation"
                        >×</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Package Link */}
            <div className="form-row" style={{ marginTop: 18 }}>
              <div style={{ width: "100%" }}>
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

            {/* Client Request */}
            <div className="form-row" style={{ marginTop: 18 }}>
              <div style={{ width: "100%" }}>
                <label style={label}>Client Request</label>
                <textarea
                  style={{ ...modernInput, height: 100, resize: "vertical", fontFamily: "inherit" }}
                  placeholder="Enter any special requests or notes from the client..."
                  maxLength={2000}
                  value={clientRequest}
                  onChange={e => setClientRequest(e.target.value)}
                />
              </div>
            </div>
            
            {/* Companions Section */}
            <div style={{ marginTop: 18 }}>
              <label style={label}>
                Companions
                {companions.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
                    ({companions.length} companion{companions.length > 1 ? 's' : ''} — auto-generated from No. of Pax)
                  </span>
                )}
              </label>
              {companions.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 14, margin: '8px 0 0' }}>
                  Increase "No. of Pax" above to auto-generate companion fields.
                </p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
                  {companions.map((comp, idx) => {
                    const filled = !!(comp.firstName || comp.lastName || comp.dob || comp.email || comp.contactNo);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCompanionModalIdx(idx)}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 6,
                          border: filled ? "2px solid #28A2DC" : "2px solid #cbd5e1",
                          background: filled ? "linear-gradient(135deg,#0A2D74,#28A2DC)" : "#f8fafc",
                          color: filled ? "#fff" : "#475569",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: "pointer",
                          boxShadow: filled ? "0 2px 8px rgba(40,162,220,0.3)" : "none",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        Companion {idx + 1}
                        {!filled && (
                          <span style={{
                            position: "absolute" as const, top: -4, right: -4,
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Companion Modal */}
            {companionModalIdx !== null && createPortal(
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 99998,
                  background: "rgba(15,23,42,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={() => setCompanionModalIdx(null)}
              >
                <div
                  style={{
                    background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 520,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setCompanionModalIdx(null)}
                    style={{
                      position: "absolute", top: 16, right: 16,
                      background: "transparent", border: "none", fontSize: 20,
                      cursor: "pointer", color: "#64748b", lineHeight: 1,
                    }}
                  >✕</button>
                  <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                    Companion {companionModalIdx + 1}
                  </h3>
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...label, display: "block", marginBottom: 6 }}>First Name</label>
                      <input
                        style={{ ...modernInput, margin: 0 }}
                        type="text"
                        placeholder="First name"
                        value={companions[companionModalIdx]?.firstName || ""}
                        onChange={e => handleCompanionChange(companionModalIdx, "firstName", e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ ...label, display: "block", marginBottom: 6 }}>Last Name</label>
                      <input
                        style={{ ...modernInput, margin: 0 }}
                        type="text"
                        placeholder="Last name"
                        value={companions[companionModalIdx]?.lastName || ""}
                        onChange={e => handleCompanionChange(companionModalIdx, "lastName", e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Date of Birth</label>
                    <input
                      style={{ ...modernInput, margin: 0 }}
                      type="date"
                      value={companions[companionModalIdx]?.dob || ""}
                      onChange={e => handleCompanionChange(companionModalIdx, "dob", e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Email Address</label>
                    <input
                      style={{ ...modernInput, margin: 0 }}
                      type="email"
                      placeholder="companion@example.com"
                      value={companions[companionModalIdx]?.email || ""}
                      onChange={e => handleCompanionChange(companionModalIdx, "email", e.target.value)}
                    />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Contact Number</label>
                    <input
                      style={{ ...modernInput, margin: 0 }}
                      type="text"
                      placeholder="e.g. +63 912 345 6789"
                      value={companions[companionModalIdx]?.contactNo || ""}
                      onChange={e => handleCompanionChange(companionModalIdx, "contactNo", e.target.value)}
                    />
                  </div>
                </div>
              </div>,
              document.body
            )}

            
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
            
            <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 240, flex: "1 1 240px" }}>
                <label style={label}>Payment Terms</label>
                <select style={modernInput} value={paymentTerm} onChange={handlePaymentTermChange}>
                  {paymentOptions.map(opt =>
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  )}
                </select>
              </div>
              {showTermCount && (
                <div style={{ minWidth: 160, flex: "0 0 160px" }}>
                  <label style={label}>Terms</label>
                  <input
                    style={modernInput}
                    type="number"
                    min={0}
                    max={customMaxTerms ?? currentOption.terms}
                    value={termCount}
                    onChange={e => {
                      let v = parseInt(e.target.value);
                      const maxAllowed = customMaxTerms ?? currentOption.terms;
                      if (isNaN(v)) v = 0;
                      if (v < 0) v = 0;
                      if (v > maxAllowed) v = maxAllowed;
                      setTermCount(v);
                      setSelectedPaymentBox(null);
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={subLabel}>(1 to {customMaxTerms ?? currentOption.terms} terms allowed)</span>
                    {!isEditingMaxTerms ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomMaxTermsInput(String(customMaxTerms ?? currentOption.terms));
                          setIsEditingMaxTerms(true);
                        }}
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          background: "#e0e7ff",
                          color: "#4338ca",
                          border: "1px solid #a5b4fc",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          whiteSpace: "nowrap"
                        }}
                      >
                        Edit
                      </button>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          min={1}
                          value={customMaxTermsInput}
                          onChange={e => setCustomMaxTermsInput(e.target.value)}
                          style={{
                            width: 56,
                            padding: "2px 6px",
                            fontSize: "12px",
                            border: "1px solid #a5b4fc",
                            borderRadius: 4,
                            outline: "none"
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const v = parseInt(customMaxTermsInput);
                            if (!isNaN(v) && v >= 1) {
                              setCustomMaxTerms(v);
                              if (termCount > v) {
                                setTermCount(v);
                                setSelectedPaymentBox(null);
                              }
                            }
                            setIsEditingMaxTerms(false);
                          }}
                          style={{
                            fontSize: "11px",
                            padding: "2px 7px",
                            background: "#4338ca",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            fontWeight: 600
                          }}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingMaxTerms(false)}
                          style={{
                            fontSize: "11px",
                            padding: "2px 7px",
                            background: "#f1f5f9",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            borderRadius: 4,
                            cursor: "pointer"
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Total Amount */}
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Total Amount</label>
              <input
                style={modernInput}
                type="text"
                placeholder="Enter total amount"
                value={totalAmount}
                onChange={e => setTotalAmount(e.target.value.replace(/[^0-9.,]/g, ''))}
              />
            </div>

            {paymentBoxes.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <label style={label}>Payment Counts</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {paymentBoxes.map(num => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setSelectedPaymentBox(num)}
                      style={{
                        width: 34, height: 34,
                        fontSize: 15,
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

            {/* Payment Details — horizontal pill list */}
            {paymentBoxes.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {paymentDetails.slice(0, paymentBoxes.length).map((detail, idx) => {
                    const hasDeposit = attachments.some(a => a.category === 'deposit-slip' && a.paymentIndex === idx && a.source === 'payment-terms');
                    const hasReceipt = attachments.some(a => a.category === 'receipt' && a.paymentIndex === idx && a.source === 'payment-terms');
                    const hasDate = !!detail.date || !!detail.dueDate;
                    const filled = hasDeposit || hasReceipt || hasDate;
                    const completed = !!detail.completed;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPaymentModalIdx(idx)}
                        style={{
                          padding: "10px 20px",
                          borderRadius: 6,
                          border: completed ? "2px solid #059669" : filled ? "2px solid #6366f1" : "2px solid #cbd5e1",
                          background: completed ? "linear-gradient(135deg,#059669,#10b981)" : filled ? "linear-gradient(135deg,#6366f1,#818cf8)" : "#f8fafc",
                          color: completed || filled ? "#fff" : "#475569",
                          fontWeight: 600,
                          fontSize: 14,
                          cursor: "pointer",
                          boxShadow: completed ? "0 2px 8px rgba(5,150,105,0.3)" : filled ? "0 2px 8px rgba(99,102,241,0.25)" : "none",
                          transition: "all 0.15s",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {completed && <span style={{ fontSize: 13 }}>✓</span>}
                        Payment {idx + 1}
                        {completed && (
                          <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.9 }}>Completed</span>
                        )}
                        {!completed && filled && (
                          <span style={{
                            position: "absolute", top: -4, right: -4,
                            width: 10, height: 10, borderRadius: "50%",
                            background: "#22c55e", border: "2px solid #fff"
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Balance Summary */}
            {paymentBoxes.length > 0 && totalAmount && (
              (() => {
                const total = parseFloat(totalAmount.replace(/,/g, '')) || 0;
                const paid = paymentDetails.slice(0, paymentBoxes.length).reduce((sum, d) => sum + (parseFloat((d.amount || '').replace(/,/g, '')) || 0), 0);
                const remaining = total - paid;
                return (
                  <div style={{ marginTop: 16, padding: "14px 18px", background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 14 }}>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 500 }}>Total Amount: </span>
                        <span style={{ color: "#1e293b", fontWeight: 700 }}>{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 500 }}>Total Paid: </span>
                        <span style={{ color: "#059669", fontWeight: 700 }}>{paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span style={{ color: "#64748b", fontWeight: 500 }}>Remaining Balance: </span>
                        <span style={{ color: remaining > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Payment Detail Modal */}
            {paymentModalIdx !== null && createPortal(
              <div
                style={{
                  position: "fixed", inset: 0, zIndex: 99998,
                  background: "rgba(15,23,42,0.45)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onClick={() => setPaymentModalIdx(null)}
              >
                <div
                  style={{
                    background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 560,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", position: "relative",
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setPaymentModalIdx(null)}
                    style={{
                      position: "absolute", top: 16, right: 16,
                      background: "transparent", border: "none", fontSize: 20,
                      cursor: "pointer", color: "#64748b", lineHeight: 1,
                    }}
                  >✕</button>

                  <h3 style={{ margin: "0 0 24px", fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                    Payment {paymentModalIdx + 1}
                  </h3>

                  {/* Completed checkbox */}
                  <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={!!paymentDetails[paymentModalIdx]?.completed}
                      onChange={e => handlePaymentDetailChange(paymentModalIdx, "completed", e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: "#059669", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: 15, fontWeight: 600, color: paymentDetails[paymentModalIdx]?.completed ? "#059669" : "#475569" }}>
                      {paymentDetails[paymentModalIdx]?.completed ? "✓ Completed" : "Mark as Completed"}
                    </span>
                  </label>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Payment Due Date</label>
                    <input
                      type="date"
                      value={paymentDetails[paymentModalIdx]?.dueDate || ""}
                      onChange={e => handlePaymentDetailChange(paymentModalIdx, "dueDate", e.target.value)}
                      style={{ ...modernInput, margin: 0 }}
                    />
                  </div>

                  {/* Payment Date */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Payment Date</label>
                    <input
                      type="date"
                      value={paymentDetails[paymentModalIdx]?.date || ""}
                      onChange={e => handlePaymentDetailChange(paymentModalIdx, "date", e.target.value)}
                      style={{ ...modernInput, margin: 0 }}
                    />
                  </div>

                  {/* Amount */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Amount</label>
                    <input
                      type="text"
                      placeholder="Enter amount"
                      value={paymentDetails[paymentModalIdx]?.amount || ""}
                      onChange={e => handlePaymentDetailChange(paymentModalIdx, "amount", e.target.value)}
                      style={{ ...modernInput, margin: 0 }}
                    />
                  </div>

                  {/* Deposit Slip */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Deposit Slip</label>
                    {(() => {
                      const uploadedFile = attachments.find(att =>
                        att.category === 'deposit-slip' && att.paymentIndex === paymentModalIdx && att.source === 'payment-terms'
                      );
                      if (uploadedFile) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: "8px 12px", background: "rgba(5,150,105,0.07)", borderRadius: 8, border: "1px solid rgba(5,150,105,0.25)" }}>
                            <span style={{ fontSize: 13, color: '#059669', flex: 1 }}>✓ {uploadedFile.file.name}</span>
                            <R2DownloadButton url={uploadedFile.file.data} fileName={uploadedFile.file.name} r2Path={uploadedFile.file.r2Path} bucket="crm-uploads" />
                            <button type="button" onClick={() => handleRemovePaymentAttachment(uploadedFile.file.id, paymentModalIdx, "depositSlip")} style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
                          </div>
                        );
                      }
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: '2px dashed rgba(147,197,253,0.6)', borderRadius: 12, background: 'rgba(239,246,255,0.7)', cursor: 'pointer' }}>
                          <span style={{ fontSize: 20 }}>📎</span>
                          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 600 }}>Choose file to upload</span>
                          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>PDF, DOCX, Image (max 10 MB)</span>
                          <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => handlePaymentDetailChange(paymentModalIdx, "depositSlip", e)} style={{ display: 'none' }} />
                        </label>
                      );
                    })()}
                  </div>

                  {/* Receipt */}
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...label, display: "block", marginBottom: 6 }}>Receipt</label>
                    {(() => {
                      const uploadedFile = attachments.find(att =>
                        att.category === 'receipt' && att.paymentIndex === paymentModalIdx && att.source === 'payment-terms'
                      );
                      if (uploadedFile) {
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: "8px 12px", background: "rgba(5,150,105,0.07)", borderRadius: 8, border: "1px solid rgba(5,150,105,0.25)" }}>
                            <span style={{ fontSize: 13, color: '#059669', flex: 1 }}>✓ {uploadedFile.file.name}</span>
                            <R2DownloadButton url={uploadedFile.file.data} fileName={uploadedFile.file.name} r2Path={uploadedFile.file.r2Path} bucket="crm-uploads" />
                            <button type="button" onClick={() => handleRemovePaymentAttachment(uploadedFile.file.id, paymentModalIdx, "receipt")} style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
                          </div>
                        );
                      }
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: '2px dashed rgba(147,197,253,0.6)', borderRadius: 12, background: 'rgba(239,246,255,0.7)', cursor: 'pointer' }}>
                          <span style={{ fontSize: 20 }}>📎</span>
                          <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 600 }}>Choose file to upload</span>
                          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>PDF, DOCX, Image (max 10 MB)</span>
                          <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={e => handlePaymentDetailChange(paymentModalIdx, "receipt", e)} style={{ display: 'none' }} />
                        </label>
                      );
                    })()}
                  </div>
                </div>
              </div>,
              document.body
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
                        accept="image/*,.pdf,.doc,.docx"
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
                        accept="image/*,.pdf,.doc,.docx"
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
                        accept="image/*,.pdf,.doc,.docx"
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
                    Previously Uploaded Payment Files ({allLegacy.length})
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

          {/* Account Relations Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>
                Account Relations
              </h2>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={label}>ARM (Account Relations Manager)</label>
              <input
                style={modernInput}
                type="text"
                placeholder="Full name"
                value={arm}
                onChange={e => setArm(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={handleSaveAccountRelations} disabled={isSavingAccountRelations} style={saveButtonStyle(isSavingAccountRelations)}>
                {isSavingAccountRelations ? "Saving..." : "Save Account Relations"}
              </button>
            </div>
          </div>

          {/* After Sales SC Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>After Sales SC</h2>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Date</label>
                <input style={modernInput} type="date" value={afterSalesSCDate} onChange={e => setAfterSalesSCDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report</label>
              <textarea style={{ ...modernInput, minHeight: 80, resize: "vertical" }} placeholder="SC report details..." value={afterSalesSCReport} onChange={e => setAfterSalesSCReport(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report By</label>
              <input style={modernInput} type="text" placeholder="Full name" value={afterSalesSCReportBy} onChange={e => setAfterSalesSCReportBy(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Add Attachment</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleGenericFileUpload(file, 'other', 'after-sales-sc-attachment', 'account-relations'); }} style={{ fontSize: "14px", width: "100%" }} />
              {(() => {
                const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'account-relations' && att.fileType === 'after-sales-sc-attachment');
                if (uploadedFile) {
                  return (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                      <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                      <button type="button" onClick={() => handleGenericFileRemove(uploadedFile.file.id, 'after-sales-sc-attachment', 'account-relations')} style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }} title="Remove file">✕</button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={handleSaveAfterSalesSC} disabled={isSavingAfterSalesSC} style={saveButtonStyle(isSavingAfterSalesSC)}>
                {isSavingAfterSalesSC ? "Saving..." : "Save After Sales SC"}
              </button>
            </div>
          </div>

          {/* Visa Section */}
          <div style={sectionStyle(windowWidth)}>
            {/* Section Header */}
            <div style={sectionHeader}>
              
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
            
            {/* Visa Officer Appointed */}
            <div style={{ marginBottom: 20 }}>
              <label style={label}>Visa Officer Appointed</label>
              <input
                style={modernInput}
                type="text"
                placeholder="Full name"
                value={visaOfficerAppointed}
                onChange={e => setVisaOfficerAppointed(e.target.value)}
              />
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
                  Visa FOC (Free of Charge)
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
                  Insurance FOC (Free of Charge)
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
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>Visa Service</span>
              </label>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={insuranceService}
                  onChange={e => setInsuranceService(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>Insurance Service</span>
              </label>
              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  style={modernCheckbox}
                  checked={eta}
                  onChange={e => setEta(e.target.checked)}
                />
                <span style={{ fontSize: "15px", color: "#1e293b", fontWeight: 600 }}>ETA</span>
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
                          accept="image/*,.pdf,.doc,.docx"
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
                          accept="image/*,.pdf,.doc,.docx"
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
                    background: "linear-gradient(135deg, #0A2D74 0%, #28A2DC 100%)",
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
                          accept="image/*,.pdf,.doc,.docx"
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
                          accept="image/*,.pdf,.doc,.docx"
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
                    background: "linear-gradient(135deg, #0A2D74 0%, #28A2DC 100%)",
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
                          accept="image/*,.pdf,.doc,.docx"
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
                          accept="image/*,.pdf,.doc,.docx"
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
                    background: "linear-gradient(135deg, #0A2D74 0%, #28A2DC 100%)",
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

            {/* Passport Information — dynamic count based on No. of Pax */}
            <h4 style={{ margin: "20px 0 12px 0", color: "#333", fontSize: "16px", fontWeight: "600" }}>
              Passport Information
              <span style={{ marginLeft: 8, fontSize: 13, color: '#6366f1', fontWeight: 500 }}>
                ({numberOfPax} passport slot{numberOfPax !== 1 ? 's' : ''} — matches No. of Pax)
              </span>
            </h4>

            {Array.from({ length: numberOfPax }, (_, idx) => (
              <div key={idx} style={{ marginBottom: 16, padding: 16, backgroundColor: "#f8f9fa", borderRadius: 8 }}>
                <h5 style={{ margin: "0 0 12px 0", color: "#333", fontSize: "14px", fontWeight: "600" }}>
                  Passport {idx + 1}{idx === 0 ? ' (Main Client)' : ` (Companion ${idx})`}
                </h5>
                <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Name</label>
                    <input
                      style={modernInput}
                      type="text"
                      placeholder="Passport holder name"
                      value={passportNames[idx] || ''}
                      onChange={e => {
                        const updated = [...passportNames];
                        updated[idx] = e.target.value;
                        setPassportNames(updated);
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={label}>Passport Attachment</label>
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleGenericFileUpload(file, 'other', `passport-${idx + 1}-attachment`, 'passport-info');
                        }
                      }}
                      style={{ fontSize: "14px" }}
                    />
                    {(() => {
                      const uploadedFile = attachments.find(att =>
                        att.category === 'other' &&
                        att.source === 'passport-info' &&
                        att.fileType === `passport-${idx + 1}-attachment`
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
                              onClick={() => handleGenericFileRemove(uploadedFile.file.id, `passport-${idx + 1}-attachment`, 'passport-info')}
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
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleGenericFileUpload(file, 'other', `passport-${idx + 1}-visa`, 'passport-info');
                        }
                      }}
                      style={{ fontSize: "14px" }}
                    />
                    {(() => {
                      const uploadedFile = attachments.find(att =>
                        att.category === 'other' &&
                        att.source === 'passport-info' &&
                        att.fileType === `passport-${idx + 1}-visa`
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
                              onClick={() => handleGenericFileRemove(uploadedFile.file.id, `passport-${idx + 1}-visa`, 'passport-info')}
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
            ))}

            {/* Legacy Passport Files (uploaded before field tracking) */}
            {(() => {
              const currentClientId2 = clientId || tempClientId;
              const legacyPassportFiles = FileService.getLegacyFilesBySource(currentClientId2, 'passport-info');
              if (legacyPassportFiles.length === 0) return null;
              return (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: '8px', border: '1px dashed rgba(99, 102, 241, 0.3)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 600, color: '#4338ca' }}>
                    Previously Uploaded Passport Files ({legacyPassportFiles.length})
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

          {/* Embassy Information Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>
                Embassy Information
              </h2>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Embassy Name</label>
                <input
                  style={modernInput}
                  type="text"
                  placeholder="Embassy name"
                  value={embassyName}
                  onChange={e => {
                    trackSectionField('embassy-information', 'embassyName', e.target.value, 'Embassy Name');
                    setEmbassyName(e.target.value);
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>Embassy Address</label>
                <input
                  style={modernInput}
                  type="text"
                  placeholder="Embassy address"
                  value={embassyAddress}
                  onChange={e => {
                    trackSectionField('embassy-information', 'embassyAddress', e.target.value, 'Embassy Address');
                    setEmbassyAddress(e.target.value);
                  }}
                />
              </div>
            </div>
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
          </div>

          {/* After Visa SC Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>After Visa SC</h2>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Date</label>
                <input style={modernInput} type="date" value={afterVisaSCDate} onChange={e => setAfterVisaSCDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report</label>
              <textarea style={{ ...modernInput, minHeight: 80, resize: "vertical" }} placeholder="SC report details..." value={afterVisaSCReport} onChange={e => setAfterVisaSCReport(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report By</label>
              <input style={modernInput} type="text" placeholder="Full name" value={afterVisaSCReportBy} onChange={e => setAfterVisaSCReportBy(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Add Attachment</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleGenericFileUpload(file, 'other', 'after-visa-sc-attachment', 'sc-report'); }} style={{ fontSize: "14px", width: "100%" }} />
              {(() => {
                const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'sc-report' && att.fileType === 'after-visa-sc-attachment');
                if (uploadedFile) {
                  return (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                      <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                      <button type="button" onClick={() => handleGenericFileRemove(uploadedFile.file.id, 'after-visa-sc-attachment', 'sc-report')} style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }} title="Remove file">✕</button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={handleSaveAfterVisaSC} disabled={isSavingAfterVisaSC} style={saveButtonStyle(isSavingAfterVisaSC)}>
                {isSavingAfterVisaSC ? "Saving..." : "Save After Visa SC"}
              </button>
            </div>
          </div>

          {/* Pre-Departure SC Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>Pre-Departure SC</h2>
            </div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>Date</label>
                <input style={modernInput} type="date" value={preDepartureSCDate} onChange={e => setPreDepartureSCDate(e.target.value)} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report</label>
              <textarea style={{ ...modernInput, minHeight: 80, resize: "vertical" }} placeholder="SC report details..." value={preDepartureSCReport} onChange={e => setPreDepartureSCReport(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report By</label>
              <input style={modernInput} type="text" placeholder="Full name" value={preDepartureSCReportBy} onChange={e => setPreDepartureSCReportBy(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Add Attachment</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleGenericFileUpload(file, 'other', 'pre-departure-sc-attachment', 'sc-report'); }} style={{ fontSize: "14px", width: "100%" }} />
              {(() => {
                const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'sc-report' && att.fileType === 'pre-departure-sc-attachment');
                if (uploadedFile) {
                  return (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                      <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                      <button type="button" onClick={() => handleGenericFileRemove(uploadedFile.file.id, 'pre-departure-sc-attachment', 'sc-report')} style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }} title="Remove file">✕</button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button type="button" onClick={handleSavePreDepartureSC} disabled={isSavingPreDepartureSC} style={saveButtonStyle(isSavingPreDepartureSC)}>
                {isSavingPreDepartureSC ? "Saving..." : "Save Pre-Departure SC"}
              </button>
            </div>
          </div>

          {/* Tour Voucher Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>Tour Voucher</h2>
            </div>

            {/* --- Voucher field renderer --- */}
            {(() => {
              const isValidUrl = (url: string) => {
                try { return ['http:', 'https:'].includes(new URL(url).protocol); } catch { return false; }
              };
              const voucherCard = (
                fieldLabel: string,
                fileType: string,
                linkValue: string,
                setLink: (v: string) => void,
                onBlurSave: () => void,
                onFileSet: (f: File | null) => void,
              ) => (
                <div key={fileType} style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
                  <label style={{ ...label, marginBottom: 10 }}>{fieldLabel}</label>
                  {/* uploaded file display */}
                  {(() => {
                    const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'booking-voucher' && att.fileType === fileType);
                    if (uploadedFile) {
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(5,150,105,0.07)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.25)', marginBottom: 10 }}>
                          <span style={{ fontSize: 13, color: '#059669', flex: 1 }}>✓ {uploadedFile.file.name}</span>
                          <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                          <button type="button" onClick={() => { handleGenericFileRemove(uploadedFile.file.id, fileType, 'booking-voucher'); onFileSet(null); }}
                            style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
                        </div>
                      );
                    }
                    return (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: '2px dashed rgba(147,197,253,0.6)', borderRadius: 12, background: 'rgba(239,246,255,0.7)', cursor: 'pointer', marginBottom: 10 }}>
                        <span style={{ fontSize: 20 }}>📎</span>
                        <span style={{ fontSize: 14, color: '#3b82f6', fontWeight: 600 }}>Choose file to upload</span>
                        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>PDF, DOCX, Image (max 10{'\u00a0'}MB)</span>
                        <input type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }}
                          onChange={async (e) => { const file = e.target.files?.[0]; if (file) { await handleGenericFileUpload(file, 'other', fileType, 'booking-voucher'); onFileSet(file); } }} />
                      </label>
                    );
                  })()}
                  {/* link */}
                  <input type="url" value={linkValue} onChange={e => setLink(e.target.value)} onBlur={onBlurSave}
                    placeholder="Or paste link here…" style={{ ...modernInput, fontSize: 13, padding: '8px 12px' }} />
                  {linkValue && isValidUrl(linkValue) && (
                    <a href={linkValue} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6', display: 'block', marginTop: 4, wordBreak: 'break-all' }}>Open link ↗</a>
                  )}
                </div>
              );

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                  {/* International Flight */}
                  {voucherCard('International Flight', 'international-flight', voucherLinkIntlFlight,
                    setVoucherLinkIntlFlight, () => saveVoucherLinks({ intlFlight: voucherLinkIntlFlight }), setIntlFlight)}

                  {/* Local Flights — dynamic add/remove */}
                  <div style={{ background: '#f0f7ff', borderRadius: 12, border: '1px solid rgba(40,162,220,0.2)', padding: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <label style={{ ...label, margin: 0 }}>
                        Local Flights
                        <span style={{ fontSize: 12, fontWeight: 400, color: '#64748b', textTransform: 'none', marginLeft: 8 }}>
                          ({localFlightLinks.length})
                        </span>
                      </label>
                      <button type="button" onClick={() => {
                        setLocalFlightLinks(prev => [...prev, '']);
                        setLocalFlightFiles(prev => [...prev, null]);
                      }} style={{
                        padding: '6px 14px', background: 'linear-gradient(135deg, #28A2DC 0%, #1a85bd 100%)',
                        color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        boxShadow: '0 2px 6px rgba(40,162,220,0.3)', transition: 'all 0.2s ease'
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Local Flight
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {localFlightLinks.map((link, idx) => (
                        <div key={idx} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 14, position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2D74' }}>Local Flight {idx + 1}</span>
                            {localFlightLinks.length > 1 && (
                              <button type="button" onClick={() => {
                                const flightFileType = `local-flight-${idx + 1}`;
                                const uploaded = attachments.find(att => att.category === 'other' && att.source === 'booking-voucher' && att.fileType === flightFileType);
                                if (uploaded) handleGenericFileRemove(uploaded.file.id, flightFileType, 'booking-voucher');
                                setLocalFlightLinks(prev => prev.filter((_, i) => i !== idx));
                                setLocalFlightFiles(prev => prev.filter((_, i) => i !== idx));
                                saveVoucherLinks({ localFlights: localFlightLinks.filter((_, i) => i !== idx) });
                              }} style={{
                                padding: '3px 10px', fontSize: 12, color: '#ef4444', background: 'transparent',
                                border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', fontWeight: 500
                              }}>✕ Remove</button>
                            )}
                          </div>
                          {/* uploaded file display */}
                          {(() => {
                            const flightFileType = `local-flight-${idx + 1}`;
                            const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'booking-voucher' && att.fileType === flightFileType);
                            if (uploadedFile) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(5,150,105,0.07)', borderRadius: 8, border: '1px solid rgba(5,150,105,0.25)', marginBottom: 8 }}>
                                  <span style={{ fontSize: 13, color: '#059669', flex: 1 }}>✓ {uploadedFile.file.name}</span>
                                  <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                                  <button type="button" onClick={() => {
                                    handleGenericFileRemove(uploadedFile.file.id, flightFileType, 'booking-voucher');
                                    setLocalFlightFiles(prev => prev.map((f, i) => i === idx ? null : f));
                                  }} style={{ fontSize: 13, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
                                </div>
                              );
                            }
                            return (
                              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', border: '2px dashed rgba(147,197,253,0.6)', borderRadius: 10, background: 'rgba(239,246,255,0.7)', cursor: 'pointer', marginBottom: 8 }}>
                                <span style={{ fontSize: 18 }}>📎</span>
                                <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>Upload file</span>
                                <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>PDF, DOCX, Image (max 10{'\u00a0'}MB)</span>
                                <input type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: 'none' }}
                                  onChange={async (e) => { const file = e.target.files?.[0]; if (file) {
                                    await handleGenericFileUpload(file, 'other', flightFileType, 'booking-voucher');
                                    setLocalFlightFiles(prev => prev.map((f, i) => i === idx ? file : f));
                                  }}} />
                              </label>
                            );
                          })()}
                          <input type="url" value={link}
                            onChange={e => setLocalFlightLinks(prev => prev.map((l, i) => i === idx ? e.target.value : l))}
                            onBlur={() => saveVoucherLinks({ localFlights: localFlightLinks })}
                            placeholder="Or paste link here…" style={{ ...modernInput, fontSize: 13, padding: '8px 12px' }} />
                          {link && isValidUrl(link) && (
                            <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#3b82f6', display: 'block', marginTop: 4, wordBreak: 'break-all' }}>Open link ↗</a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tour Voucher */}
                  {voucherCard('Tour Voucher', 'tour-voucher', voucherLinkTourVoucher,
                    setVoucherLinkTourVoucher, () => saveVoucherLinks({ tourVoucher: voucherLinkTourVoucher }), setTourVoucher)}

                  {/* Hotel Voucher */}
                  {voucherCard('Hotel Voucher', 'hotel-voucher', voucherLinkHotelVoucher,
                    setVoucherLinkHotelVoucher, () => saveVoucherLinks({ hotelVoucher: voucherLinkHotelVoucher }), setHotelVoucher)}

                  {/* Other Files */}
                  {voucherCard('Other Files', 'other-files', voucherLinkOtherFiles,
                    setVoucherLinkOtherFiles, () => saveVoucherLinks({ otherFiles: voucherLinkOtherFiles }), setOtherFiles)}
                </div>
              );
            })()}

            {/* Legacy Booking/Voucher Files (uploaded before field tracking) */}
            {(() => {
              const currentClientId = clientId || tempClientId;
              const legacyFiles = FileService.getLegacyFilesBySource(currentClientId, 'booking-voucher');
              if (legacyFiles.length === 0) return null;
              return (
                <div style={{ marginTop: 16, padding: 12, background: 'rgba(251,191,36,0.1)', borderRadius: 8, border: '1px dashed rgba(251,191,36,0.4)' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                    Previously Uploaded Files ({legacyFiles.length})
                  </p>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#a16207' }}>
                    These were uploaded before field tracking. Re-upload above, then remove these.
                  </p>
                  {legacyFiles.map(att => (
                    <div key={att.file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#059669' }}>✓ {att.file.name}</span>
                      <R2DownloadButton r2Path={att.file.r2Path} className="" />
                      <button type="button" onClick={() => handleGenericFileRemove(att.file.id, 'legacy', 'booking-voucher')}
                        style={{ fontSize: 14, color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Post-Departure SC Section */}
          <div style={sectionStyle(windowWidth)}>
            <div style={sectionHeader}>
              <h2 style={{ margin: 0, color: "#0A2D74", fontSize: "19px", fontWeight: 700, letterSpacing: "0.01em" }}>
                Post-Departure
              </h2>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Date</label>
              <input style={modernInput} type="date" value={postDepartureSCDate} onChange={e => setPostDepartureSCDate(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report</label>
              <textarea style={{ ...modernInput, minHeight: 80, resize: "vertical" }} placeholder="SC report details..." value={postDepartureSCReport} onChange={e => setPostDepartureSCReport(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>SC Report By</label>
              <input style={modernInput} type="text" placeholder="Full name" value={postDepartureSCReportBy} onChange={e => setPostDepartureSCReportBy(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={label}>Add Attachment</label>
              <input type="file" accept="image/*,.pdf,.doc,.docx" onChange={async (e) => { const file = e.target.files?.[0]; if (file) await handleGenericFileUpload(file, 'other', 'post-departure-sc-attachment', 'sc-report'); }} style={{ fontSize: "14px", width: "100%" }} />
              {(() => {
                const uploadedFile = attachments.find(att => att.category === 'other' && att.source === 'sc-report' && att.fileType === 'post-departure-sc-attachment');
                if (uploadedFile) {
                  return (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: "12px", color: "#059669" }}>✓ {uploadedFile.file.name}</span>
                      <R2DownloadButton r2Path={uploadedFile.file.r2Path} className="" />
                      <button type="button" onClick={() => handleGenericFileRemove(uploadedFile.file.id, 'post-departure-sc-attachment', 'sc-report')} style={{ fontSize: '14px', color: '#ef4444', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }} title="Remove file">✕</button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                onClick={handleSavePostDepartureSC}
                disabled={isSavingPostDepartureSC}
                style={saveButtonStyle(isSavingPostDepartureSC)}
              >
                {isSavingPostDepartureSC ? "Saving..." : "Save Post-Departure SC"}
              </button>
            </div>
          </div>

          {/* Activity Log & Notes Section */}
          <div style={{ ...sectionStyle(windowWidth), marginTop: "24px" }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(147,197,253,0.3)',
              marginBottom: '16px'
            }}>
              <button
                type="button"
                onClick={() => setBottomPanelTab('activity')}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  border: 'none',
                  borderBottom: bottomPanelTab === 'activity' ? '3px solid #3b82f6' : '3px solid transparent',
                  background: bottomPanelTab === 'activity' ? '#eff6ff' : 'transparent',
                  color: bottomPanelTab === 'activity' ? '#1d4ed8' : '#6b7280',
                  fontWeight: bottomPanelTab === 'activity' ? 700 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5
                }}
              >
                Activity Log
              </button>
              <button
                type="button"
                onClick={() => setBottomPanelTab('notes')}
                style={{
                  flex: 1,
                  padding: '11px 8px',
                  border: 'none',
                  borderBottom: bottomPanelTab === 'notes' ? '3px solid #f59e0b' : '3px solid transparent',
                  background: bottomPanelTab === 'notes' ? '#fffbeb' : 'transparent',
                  color: bottomPanelTab === 'notes' ? '#b45309' : '#6b7280',
                  fontWeight: bottomPanelTab === 'notes' ? 700 : 500,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5
                }}
              >
                Notes & Requests
              </button>
            </div>

            {/* Tab content */}
            {bottomPanelTab === 'activity' ? (
              currentClientId ? (
                <LogNoteComponent
                  key={logRefreshKey}
                  clientId={currentClientId}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                />
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: '600' }}>
                    Activity Log
                  </h3>
                  <p style={{ color: '#64748b', fontSize: '13px' }}>
                    Activity log will appear when a client is saved.
                  </p>
                </div>
              )
            ) : (
              currentClientId ? (
                <NotesThreadComponent
                  key={currentClientId}
                  clientId={currentClientId}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                />
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '1.1rem', fontWeight: '600' }}>
                    Notes & Requests
                  </h3>
                  <p style={{ color: '#b45309', fontSize: '13px' }}>
                    Notes will appear when a client is saved.
                  </p>
                </div>
              )
            )}
          </div>
          </>
          )}
        </form>
      </div>
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
      case 'float': return '#f59e0b';
      case 'refund': return '#8b5cf6';
      case 'travel funds': return '#0ea5e9';
      case 'rebook': return '#06b6d4';
      case 'cancelled': return '#F44336';
      case 'lead': return '#2196F3';
      case 'referral': return '#FF9800';
      case 'transferred': return '#9C27B0';
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
              background: 'transparent'
            }}>
            <ClientRecords
              onClientSelect={() => {}}
              onNavigateBack={() => setViewingForm(null)}
              clientId={viewingForm.clientId}
              currentUser={currentUser}
              onClientIdResolved={(realId) => setViewingForm({ clientId: realId })}
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
            background: 'transparent'
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
            background: 'transparent'
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
            background: 'transparent'
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
            background: 'transparent'
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
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column'
          }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #0A2D74 0%, #1a4a9e 60%, #28A2DC 100%)',
          padding: '20px 28px',
          borderRadius: '14px',
          boxShadow: '0 4px 20px rgba(10, 45, 116, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              border: '2px solid rgba(255,255,255,0.4)',
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0
            }}>
              <img
                src={localStorage.getItem('crm_company_logo') || '/DG.jpg'}
                alt="Logo"
                onError={(e) => { e.currentTarget.src = '/DG.jpg'; }}
                style={{ width: '42px', height: '42px', objectFit: 'contain' }}
              />
            </div>
            <div>
              <h1 style={{ 
                margin: '0 0 4px 0',
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: '800',
                fontFamily: "'Poppins', sans-serif",
                letterSpacing: '0.05em'
              }}>
                Client Records
              </h1>
              <p style={{ 
                margin: 0,
                color: 'rgba(255,255,255,0.75)',
                fontSize: '13px'
              }}>
                Manage and search through all client documents
              </p>
            </div>
          </div>
          <button
            onClick={handleAddNewClient}
            style={{
              padding: '11px 22px',
              background: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1.5px solid rgba(255,255,255,0.5)',
              borderRadius: '10px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)',
              whiteSpace: 'nowrap'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.35)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            + Add New Client
          </button>
        </div>

        {/* Search and Filter Section */}
        <div style={{
          background: '#ffffff',
          padding: '20px 24px',
          borderRadius: '14px',
          marginBottom: '20px',
          boxShadow: '0 2px 12px rgba(10, 45, 116, 0.08)',
          border: '1px solid rgba(10, 45, 116, 0.1)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '16px',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '12px',
                color: '#0A2D74',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
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
                  padding: '11px 14px',
                  border: '1.5px solid #d1dbe8',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#f8fafc',
                  color: '#1e293b',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#28A2DC';
                  e.target.style.boxShadow = '0 0 0 3px rgba(40, 162, 220, 0.12)';
                  e.target.style.background = '#ffffff';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1dbe8';
                  e.target.style.boxShadow = 'none';
                  e.target.style.background = '#f8fafc';
                }}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600',
                fontSize: '12px',
                color: '#0A2D74',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  border: '1.5px solid #d1dbe8',
                  borderRadius: '10px',
                  fontSize: '14px',
                  background: '#f8fafc',
                  color: '#1e293b',
                  cursor: 'pointer'
                }}
              >
                            <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Float">Float</option>
                <option value="Refund">Refund</option>
                <option value="Travel Funds">Travel Funds</option>
                <option value="Rebook">Rebook</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 40px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 12px rgba(10, 45, 116, 0.08)',
            border: '1px solid rgba(10, 45, 116, 0.1)'
          }}>
            <p style={{ color: '#64748b', fontSize: '15px' }}>Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 40px',
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 12px rgba(10, 45, 116, 0.08)',
            border: '1px solid rgba(10, 45, 116, 0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>
              👥
            </div>
            <h3 style={{ color: '#0A2D74', margin: '0 0 8px 0', fontWeight: '700' }}>
              {searchQuery || statusFilter ? 'No Clients Found' : 'No Clients Yet'}
            </h3>
            <p style={{ color: '#94a3b8', margin: '0 0 20px 0', fontSize: '14px' }}>
              {searchQuery || statusFilter 
                ? 'Try adjusting your search criteria or filters.'
                : 'Start by adding your first client to the system.'
              }
            </p>
            {!searchQuery && !statusFilter && (
              <button
                onClick={handleAddNewClient}
                style={{
                  padding: '12px 28px',
                  background: 'linear-gradient(135deg, #0A2D74 0%, #28A2DC 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  boxShadow: '0 4px 14px rgba(10, 45, 116, 0.3)'
                }}
              >
                + Add First Client
              </button>
            )}
          </div>
        ) : (
          <div style={{
            background: '#ffffff',
            borderRadius: '14px',
            boxShadow: '0 2px 12px rgba(10, 45, 116, 0.08)',
            border: '1px solid rgba(10, 45, 116, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}>
            <div style={{
              padding: '16px 24px',
              borderBottom: '2px solid rgba(40, 162, 220, 0.2)',
              background: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '16px' }}>👥</span>
              <h3 style={{ margin: 0, color: '#0A2D74', fontWeight: '700', fontSize: '15px' }}>
                Client List
              </h3>
              <span style={{
                marginLeft: '4px',
                background: '#0A2D74',
                color: '#fff',
                borderRadius: '20px',
                padding: '2px 10px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {clients.length} {clients.length === 1 ? 'client' : 'clients'}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', minHeight: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '650px'
              }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #0A2D74 0%, #1a4a9e 100%)' }}>
                    <th style={{
                      padding: '13px 20px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Client Name
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Status
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Email
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Phone
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Client No.
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      whiteSpace: 'nowrap'
                    }}>
                      Agent
                    </th>
                    <th style={{
                      padding: '13px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: 'rgba(255,255,255,0.85)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
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
                        borderBottom: '1px solid rgba(10, 45, 116, 0.07)',
                        background: index % 2 === 0 ? '#ffffff' : '#f8faff',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(40, 162, 220, 0.07)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = index % 2 === 0 ? '#ffffff' : '#f8faff')}
                      onClick={() => handleClientEdit(client)}
                    >
                      <td style={{
                        padding: '15px 20px',
                        color: '#0A2D74',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {client.contactName}
                      </td>
                      <td style={{ padding: '15px 16px' }}>
                        <span style={{
                          padding: '4px 12px',
                          backgroundColor: getStatusColor(client.status || 'unknown'),
                          color: 'white',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          display: 'inline-block',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                        }}>
                          {client.status}
                        </span>
                      </td>
                      <td style={{
                        padding: '15px 16px',
                        color: '#64748b',
                        fontSize: '13px'
                      }}>
                        {client.email || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No email</span>}
                      </td>
                      <td style={{
                        padding: '15px 16px',
                        color: '#64748b',
                        fontSize: '13px'
                      }}>
                        {client.contactNo || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>No phone</span>}
                      </td>
                      <td style={{
                        padding: '15px 16px',
                        color: '#64748b',
                        fontSize: '13px',
                        fontFamily: 'monospace'
                      }}>
                        {client.clientNo || '—'}
                      </td>
                      <td style={{
                        padding: '15px 16px',
                        color: '#64748b',
                        fontSize: '13px'
                      }}>
                        {client.agent || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Unassigned</span>}
                      </td>
                      <td style={{
                        padding: '15px 16px',
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
                              background: 'linear-gradient(135deg, #28A2DC 0%, #1a85bd 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 6px rgba(40, 162, 220, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 10px rgba(40, 162, 220, 0.45)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(40, 162, 220, 0.3)';
                            }}
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
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.45)';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.3)';
                            }}
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