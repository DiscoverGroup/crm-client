import React, { useState, useEffect } from "react";
import { PaymentService, type PaymentData } from "../payments/paymentService";
import type { PaymentDetail } from "../types/payment";
import { ClientService, type ClientData } from "../services/clientService";
import Sidebar from "./Sidebar";

// Utility for modern UI
const modernInput = {
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  fontSize: "16px",
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#f9f9fb"
};
const sectionStyle = {
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 2px 8px 0 #e9e9f0",
  padding: 28,
  marginBottom: 28
};
const label = {
  fontWeight: 600,
  color: "#333",
  marginBottom: 6,
  display: "block"
};
const subLabel = {
  fontWeight: 400,
  color: "#555",
  fontSize: "14px",
  marginTop: 3
};

const saveButtonStyle = (isSaving: boolean) => ({
  background: isSaving ? "#9ca3af" : "#2563eb",
  color: "#fff",
  padding: "8px 16px",
  border: "none",
  borderRadius: "6px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: isSaving ? "not-allowed" : "pointer",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
  transition: "background-color 0.2s ease",
  marginTop: "16px"
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

const MainPage: React.FC = () => {
  // Navigation state
  const [currentPage, setCurrentPage] = useState<'form' | 'clientRecords'>('form');

  // Client selection state
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [isNewClient, setIsNewClient] = useState(true);

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
  const [packageLink, setPackageLink] = useState("");

  // State
  const [paymentTerm, setPaymentTerm] = useState(paymentOptions[0].value);
  const [termCount, setTermCount] = useState(1); // How many terms for installment/travel_funds
  const [selectedPaymentBox, setSelectedPaymentBox] = useState<number | null>(null);

  // Companions (with details)
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [newCompanion, setNewCompanion] = useState<Companion>({
    name: "",
    dob: "",
    address: "",
    occupation: ""
  });

  // Passports: always 1 for client, + companions
  const passports = [
    { label: "Client", name: "" },
    ...companions.map((comp, idx) => ({ label: `Companion ${idx + 1}`, name: comp.name }))
  ];

  // PaymentTerm-driven behavior
  const currentOption = paymentOptions.find(opt => opt.value === paymentTerm)!;
  const showTermCount = paymentTerm === "installment" || paymentTerm === "travel_funds";
  const paymentBoxes = Array.from({ length: currentOption.value === "installment" || currentOption.value === "travel_funds" ? termCount : currentOption.terms }, (_, i) => i + 1);

  // Payment Details Table for terms
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetail[]>(
    Array.from({ length: termCount }, () => ({ date: "", depositSlip: null, receipt: null }))
  );

  // Additional payment states
  const [firstPaymentEnabled, setFirstPaymentEnabled] = useState(false);
  const [firstPaymentDate, setFirstPaymentDate] = useState("");
  const [firstPaymentDepositSlip, setFirstPaymentDepositSlip] = useState<File | null>(null);
  const [firstPaymentReceipt, setFirstPaymentReceipt] = useState<File | null>(null);
  
  const [secondPaymentDate, setSecondPaymentDate] = useState("");
  const [secondPaymentDepositSlip, setSecondPaymentDepositSlip] = useState<File | null>(null);
  const [secondPaymentReceipt, setSecondPaymentReceipt] = useState<File | null>(null);
  
  const [thirdPaymentDate, setThirdPaymentDate] = useState("");
  const [thirdPaymentDepositSlip, setThirdPaymentDepositSlip] = useState<File | null>(null);
  const [thirdPaymentReceipt, setThirdPaymentReceipt] = useState<File | null>(null);
  
  const [otherPaymentsEnabled, setOtherPaymentsEnabled] = useState(false);
  const [otherPaymentsDescription, setOtherPaymentsDescription] = useState("");
  const [otherPaymentsAttachment, setOtherPaymentsAttachment] = useState<File | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isSavingPackage, setIsSavingPackage] = useState(false);
  const [isSavingVisa, setIsSavingVisa] = useState(false);
  const [isSavingPassports, setIsSavingPassports] = useState(false);
  const [isSavingEmbassy, setIsSavingEmbassy] = useState(false);

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

  const handlePaymentDetailChange = (
    idx: number,
    field: "date" | "depositSlip" | "receipt",
    value: string | React.ChangeEvent<HTMLInputElement>
  ) => {
    setPaymentDetails(pd =>
      pd.map((row, i) => {
        if (i !== idx) return row;
        if (field === "date") {
          return { ...row, date: value as string };
        }
        const event = value as React.ChangeEvent<HTMLInputElement>;
        const file = event?.target?.files?.[0] || null;
        return { ...row, [field]: file };
      })
    );
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

      const success = await PaymentService.savePaymentData(paymentData);
      if (success) {
        alert('Payment details saved successfully!');
      } else {
        alert('Failed to save payment details. Please try again.');
      }
    } catch (error) {
      console.error('Error saving payment details:', error);
      alert('An error occurred while saving payment details.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClientInfo = async () => {
    setIsSavingClient(true);
    try {
      const clientData = {
        clientNo: clientNo || `CLT-${Date.now()}`,
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

      if (selectedClient) {
        // Update existing client
        await ClientService.updateClient(selectedClient.id, clientData);
        alert('Client information updated successfully!');
      } else {
        // Create new client
        const { clientId: savedClientId } = await ClientService.saveClient(clientData);
        alert('Client information saved successfully!');
        
        // Load the newly created client
        const newClient = ClientService.getClientById(savedClientId);
        if (newClient) {
          setSelectedClient(newClient);
          setIsNewClient(false);
        }
      }

      // Trigger client list refresh
      window.dispatchEvent(new Event('clientDataUpdated'));
    } catch (error) {
      console.error('Error saving client info:', error);
      alert('An error occurred while saving client information.');
    } finally {
      setIsSavingClient(false);
    }
  };

  // Navigation handlers
  const handleNavigateToClientRecords = () => {
    setCurrentPage('clientRecords');
  };

  const handleNavigateBackToForm = () => {
    setCurrentPage('form');
  };

  const handleSavePackageInfo = async () => {
    setIsSavingPackage(true);
    try {
      // Simulate saving package & companions info
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Package & companions information saved successfully!');
    } catch (error) {
      console.error('Error saving package info:', error);
      alert('An error occurred while saving package information.');
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleSaveVisaServices = async () => {
    setIsSavingVisa(true);
    try {
      // Simulate saving visa services
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Visa services saved successfully!');
    } catch (error) {
      console.error('Error saving visa services:', error);
      alert('An error occurred while saving visa services.');
    } finally {
      setIsSavingVisa(false);
    }
  };

  const handleSavePassports = async () => {
    setIsSavingPassports(true);
    try {
      // Simulate saving passport info
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Passport information saved successfully!');
    } catch (error) {
      console.error('Error saving passport info:', error);
      alert('An error occurred while saving passport information.');
    } finally {
      setIsSavingPassports(false);
    }
  };

  const handleSaveEmbassy = async () => {
    setIsSavingEmbassy(true);
    try {
      // Simulate saving embassy info
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Embassy information saved successfully!');
    } catch (error) {
      console.error('Error saving embassy info:', error);
      alert('An error occurred while saving embassy information.');
    } finally {
      setIsSavingEmbassy(false);
    }
  };

  // Handlers
  function handleCompanionFieldChange(field: keyof Companion, value: string) {
    setNewCompanion({ ...newCompanion, [field]: value });
  }

  function handleAddCompanion() {
    if (newCompanion.name.trim()) {
      setCompanions([...companions, newCompanion]);
      setNewCompanion({ name: "", dob: "", address: "", occupation: "" });
    }
  }

  function handleRemoveCompanion(idx: number) {
    setCompanions(companions.filter((_, i) => i !== idx));
  }

  function handlePaymentTermChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = e.target.value;
    setPaymentTerm(selected);
    const opt = paymentOptions.find(o => o.value === selected)!;
    if (selected === "installment" || selected === "travel_funds") {
      setTermCount(2); // default for these types
    } else {
      setTermCount(opt.terms);
    }
    setSelectedPaymentBox(null);
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <Sidebar
        onNavigateToClientRecords={handleNavigateToClientRecords}
        onNavigateToProfile={() => {}}
        onNavigateToDeleted={() => {}}
        onNavigateToActivityLog={() => {}}
      />
      
      {/* Main Content */}
      {currentPage === 'form' ? (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          background: "#f4f7fa"
        }}>
          <div style={{
          maxWidth: 960,
          margin: "40px auto",
          padding: 0,
          background: "#f4f7fa",
          borderRadius: 16,
          boxShadow: "0 4px 32px 0 #e2e6f0"
        }}>
          <form style={{ padding: 24 }} autoComplete="off">
            {/* Header */}
            <div style={{ 
              background: "#fff", 
              borderRadius: 12, 
              padding: 20, 
              marginBottom: 24,
              boxShadow: "0 2px 8px 0 #e9e9f0"
            }}>
              <h1 style={{ 
                margin: 0, 
                color: "#1e293b", 
                fontSize: "24px", 
                fontWeight: 700 
              }}>
                {isNewClient ? "New Client Registration" : `Editing: ${selectedClient?.contactName || 'Client'}`}
              </h1>
              {selectedClient && (
                <p style={{ 
                  margin: "8px 0 0 0", 
                  color: "#64748b", 
                  fontSize: "14px" 
                }}>
                  Client ID: {selectedClient.id} | Last updated: {new Date(selectedClient.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
            {/* Client Info */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", gap: 32 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Client No</label>
                  <input 
                    style={modernInput} 
                    type="text" 
                    placeholder="Auto-generated or enter client number"
                    value={clientNo}
                    onChange={e => setClientNo(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Status</label>
                  <select 
                    style={modernInput}
                    value={status}
                    onChange={e => setStatus(e.target.value)}
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
                    onChange={e => setAgent(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Contact No</label>
                  <input 
                    style={modernInput} 
                    type="text" 
                    placeholder="Contact number"
                    value={contactNo}
                    onChange={e => setContactNo(e.target.value)}
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
                    onChange={e => setContactName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Email</label>
                  <input 
                    style={modernInput} 
                    type="email" 
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Date of Birth</label>
                  <input 
                    style={modernInput} 
                    type="date"
                    value={dateOfBirth}
                    onChange={e => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveClientInfo}
              disabled={isSavingClient}
              style={saveButtonStyle(isSavingClient)}
            >
              {isSavingClient ? "Saving..." : "Save Client Info"}
            </button>
          </div>
        </div>

            {/* Package & Companions */}
            <div style={sectionStyle}>
              <div style={{ display: "flex", gap: 32 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Package</label>
                  <input 
                    style={modernInput} 
                    type="text" 
                    placeholder="Package name"
                    value={packageName}
                    onChange={e => setPackageName(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Travel Date</label>
                  <input 
                    style={modernInput} 
                    type="date"
                    value={travelDate}
                    onChange={e => setTravelDate(e.target.value)}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>No. of Pax</label>
                  <input 
                    style={modernInput} 
                    type="number" 
                    min={1}
                    value={numberOfPax}
                    onChange={e => setNumberOfPax(parseInt(e.target.value) || 1)}
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
                    onChange={e => setBookingConfirmation(e.target.value)}
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
              </div>          {/* Companions Section */}
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
          <label style={label}>Payment Terms & Schedule</label>
          
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
              {showTermCount &&
                <span style={subLabel}>Click a box to select active payment term.</span>
              }
            </div>
          </div>

          {/* Payment Details Table */}
          {showTermCount && (
            <div style={{ marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#fafaff", borderRadius: 8, boxShadow: "0 1px 4px #e5e7eb" }}>
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: 8, border: "1px solid #e5e7eb" }}>Payment No</th>
                    <th style={{ padding: 8, border: "1px solid #e5e7eb" }}>Date</th>
                    <th style={{ padding: 8, border: "1px solid #e5e7eb" }}>Deposit Slip</th>
                    <th style={{ padding: 8, border: "1px solid #e5e7eb" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentDetails.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ textAlign: "center", padding: 8, border: "1px solid #e5e7eb" }}>{idx + 1}</td>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb" }}>
                        <input
                          type="date"
                          style={modernInput}
                          value={row.date}
                          onChange={e => handlePaymentDetailChange(idx, "date", e.target.value)}
                        />
                      </td>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb" }}>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={e => handlePaymentDetailChange(idx, "depositSlip", e)}
                        />
                        {row.depositSlip && (
                          <div style={{ fontSize: 12, color: "#2563eb" }}>{row.depositSlip.name}</div>
                        )}
                      </td>
                      <td style={{ padding: 8, border: "1px solid #e5e7eb" }}>
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          onChange={e => handlePaymentDetailChange(idx, "receipt", e)}
                        />
                        {row.receipt && (
                          <div style={{ fontSize: 12, color: "#2563eb" }}>{row.receipt.name}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Additional Payment Schedule Options */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 180px auto auto auto auto", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={firstPaymentEnabled}
                  onChange={e => setFirstPaymentEnabled(e.target.checked)}
                /> 1st Payment Date:
              </label>
              <input 
                type="date" 
                style={{ ...modernInput, width: 160 }}
                value={firstPaymentDate}
                onChange={e => setFirstPaymentDate(e.target.value)}
                disabled={!firstPaymentEnabled}
              />
              <span>Deposit Slip:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setFirstPaymentDepositSlip(e.target.files?.[0] || null)}
                disabled={!firstPaymentEnabled}
              />
              <span>Receipt:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setFirstPaymentReceipt(e.target.files?.[0] || null)}
                disabled={!firstPaymentEnabled}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 180px auto auto auto auto", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <span>2nd Payment Date:</span>
              <input 
                type="date" 
                style={{ ...modernInput, width: 160 }}
                value={secondPaymentDate}
                onChange={e => setSecondPaymentDate(e.target.value)}
              />
              <span>Deposit Slip:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setSecondPaymentDepositSlip(e.target.files?.[0] || null)}
              />
              <span>Receipt:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setSecondPaymentReceipt(e.target.files?.[0] || null)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 180px auto auto auto auto", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <span>3rd Payment Date:</span>
              <input 
                type="date" 
                style={{ ...modernInput, width: 160 }}
                value={thirdPaymentDate}
                onChange={e => setThirdPaymentDate(e.target.value)}
              />
              <span>Deposit Slip:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setThirdPaymentDepositSlip(e.target.files?.[0] || null)}
              />
              <span>Receipt:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setThirdPaymentReceipt(e.target.files?.[0] || null)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 220px auto auto", alignItems: "center", gap: 16, marginBottom: 20 }}>
              <label>
                <input 
                  type="checkbox" 
                  checked={otherPaymentsEnabled}
                  onChange={e => setOtherPaymentsEnabled(e.target.checked)}
                /> Other Payments:
              </label>
              <input 
                type="text" 
                placeholder="Specify" 
                style={{ ...modernInput, width: 220 }}
                value={otherPaymentsDescription}
                onChange={e => setOtherPaymentsDescription(e.target.value)}
                disabled={!otherPaymentsEnabled}
              />
              <span>Attachment:</span>
              <input 
                type="file" 
                accept="application/pdf,image/*" 
                style={{ fontSize: "14px" }}
                onChange={e => setOtherPaymentsAttachment(e.target.files?.[0] || null)}
                disabled={!otherPaymentsEnabled}
              />
            </div>
            
            {/* Save Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button
                type="button"
                onClick={handleSavePaymentDetails}
                disabled={isSaving}
                style={{
                  background: isSaving ? "#9ca3af" : "#2563eb",
                  color: "#fff",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "16px",
                  fontWeight: 600,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  transition: "background-color 0.2s ease"
                }}
              >
                {isSaving ? "Saving..." : "Save Payment Details"}
              </button>
            </div>
          </div>
        </div>

        {/* Visa Services */}
        <div style={sectionStyle}>
          <label style={label}>Visa and other services</label>
          <div style={{ display: "flex", gap: 28, marginBottom: 10 }}>
            <label><input type="checkbox" /> Visa Service</label>
            <label><input type="checkbox" /> Insurance Service</label>
            <label><input type="checkbox" /> E+TA</label>
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            <label><input type="checkbox" /> PDF deposit slip</label>
            <label><input type="checkbox" /> PDF deposit slip</label>
          </div>
          
          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveVisaServices}
              disabled={isSavingVisa}
              style={saveButtonStyle(isSavingVisa)}
            >
              {isSavingVisa ? "Saving..." : "Save Visa Services"}
            </button>
          </div>
        </div>

        {/* Passports */}
        <div style={sectionStyle}>
          <label style={label}>Passports</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {passports.map((comp, i) => (
              <div
                key={i}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 110px 1fr 70px 60px 60px 1fr 60px",
                  alignItems: "center",
                  background: i === 0 ? "#f3f4f6" : "#f8fafc",
                  borderRadius: 8,
                  padding: "12px 0",
                  gap: 8,
                  overflowX: "auto"
                }}
              >
                <span>{i === 0 ? "Client" : `Companion ${i}`}</span>
                <input
                  style={{ ...modernInput, width: "100%", minWidth: 100, background: "#fff" }}
                  type="text"
                  placeholder={`Name ${i + 1}`}
                  value={comp.name}
                  readOnly
                />
                <span style={{ color: "#555" }}>Attachment:</span>
                <input type="file" />
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" /> PDF
                </label>
                <span style={{ color: "#555" }}>Visa:</span>
                <input type="file" />
                <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input type="checkbox" /> PDF
                </label>
              </div>
            ))}
          </div>
          
          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSavePassports}
              disabled={isSavingPassports}
              style={saveButtonStyle(isSavingPassports)}
            >
              {isSavingPassports ? "Saving..." : "Save Passports"}
            </button>
          </div>
        </div>

        {/* Payment Attachments Viewer */}
        <div style={sectionStyle}>
          <label style={label}>Payment Attachments</label>
          <div style={{
            padding: '16px',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <span style={{ fontWeight: '500', color: '#495057' }}>
                Uploaded Files
              </span>
              <button
                type="button"
                onClick={() => {
                  // Navigate to client records to view all attachments
                  setCurrentPage('clientRecords');
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                📎 View All Attachments
              </button>
            </div>
            <div style={{
              fontSize: '14px',
              color: '#6c757d',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>📁</div>
              <p style={{ margin: 0 }}>
                Upload payment files using the file inputs above, then click "View All Attachments" to preview and manage them.
              </p>
            </div>
          </div>
        </div>

        {/* Embassy */}
        <div style={sectionStyle}>
          <label style={label}>Embassy</label>
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <div>
              <span style={{ minWidth: 140, display: "inline-block" }}>Appointment Date:</span>
              <input type="date" style={modernInput} />
            </div>
            <div>
              <span style={{ minWidth: 170, display: "inline-block" }}>Release of Visa Date:</span>
              <input type="date" style={modernInput} />
            </div>
            <div>
              <span style={{ minWidth: 180, display: "inline-block" }}>Visa Result Advisory Date:</span>
              <input type="date" style={modernInput} />
            </div>
          </div>
          
          {/* Save Button */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSaveEmbassy}
              disabled={isSavingEmbassy}
              style={saveButtonStyle(isSavingEmbassy)}
            >
              {isSavingEmbassy ? "Saving..." : "Save Embassy Info"}
            </button>
          </div>
        </div>
          </form>
        </div>
      </div>
      ) : (
        <div style={{ flex: 1, padding: '20px' }}>
          <h2>Client Records</h2>
          <p>Client records functionality would go here.</p>
          <button 
            onClick={handleNavigateBackToForm}
            style={{
              background: "#2563eb",
              color: "#fff",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Back to Form
          </button>
        </div>
      )}
    </div>
  );
};

export default MainPage;