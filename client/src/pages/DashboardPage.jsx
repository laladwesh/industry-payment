import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import StatusBadge from "../components/common/StatusBadge";
import StepBar from "../components/common/StepBar";
import PortalNavbar from "../components/layout/PortalNavbar";
import { CONCLAVE_DATES } from "../constants/branding";
import { MAX_ATTENDEES, emptyAttendee } from "../constants/registration";
import { clearAuth } from "../utils/authStorage";
import { formatMoney, formatRegistrationId } from "../utils/formatters";
import { downloadRegistrationProof } from "../utils/proofDownload";

const emptyRepresentative = {
  companyName: "",
  personName: "",
  designation: "",
  email: "",
  contact: "",
  companyProfile: "",
};

const emptyPaymentMeta = {
  transactionId: "",
  paymentDate: "",
  billingAddress: "",
};

function toInputDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function DashboardPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [existingRegistration, setExistingRegistration] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [wizardStep, setWizardStep] = useState(1);
  const [fillDetailsNow, setFillDetailsNow] = useState(false);
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [representative, setRepresentative] = useState({ ...emptyRepresentative });
  const [attendees, setAttendees] = useState(Array.from({ length: MAX_ATTENDEES }, () => ({ ...emptyAttendee })));
  const [draftRegistration, setDraftRegistration] = useState(null);
  const [wizardProofFile, setWizardProofFile] = useState(null);
  const [wizardPaymentMeta, setWizardPaymentMeta] = useState({ ...emptyPaymentMeta });
  const [wizardSubmitting, setWizardSubmitting] = useState(false);
  const [wizardUploading, setWizardUploading] = useState(false);
  const [interestConsent, setInterestConsent] = useState(false);

  const visibleAttendees = useMemo(() => attendees.slice(0, attendeeCount), [attendees, attendeeCount]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [meResponse, registrationsResponse, instructionsResponse] = await Promise.all([
        api.get("/x9a-kk/p3"),
        api.get("/v7m-qr/r1"),
        api.get("/n4p-zk/f0"),
      ]);

      const meUser = meResponse.data.user || null;
      setUser(meUser);
      const primaryRegistration = (registrationsResponse.data.registrations || [])[0] || null;
      setExistingRegistration(primaryRegistration);
      if (!draftRegistration && primaryRegistration) {
        setDraftRegistration(primaryRegistration);
        setWizardStep(5);
      }

      if (primaryRegistration?.representative) {
        setRepresentative({
          companyName: primaryRegistration.representative.companyName || "",
          personName: primaryRegistration.representative.personName || "",
          designation: primaryRegistration.representative.designation || "",
          email: primaryRegistration.representative.email || "",
          contact: primaryRegistration.representative.contact || "",
          companyProfile: primaryRegistration.representative.companyProfile || "",
        });
      } else if (meUser) {
        setRepresentative((prev) => ({
          ...prev,
          personName: prev.personName || meUser.name || "",
          email: prev.email || meUser.email || "",
        }));
      }

      if (primaryRegistration?.payment) {
        setWizardPaymentMeta({
          transactionId: primaryRegistration.payment.transactionId || "",
          paymentDate: toInputDate(primaryRegistration.payment.paymentDate),
          billingAddress: primaryRegistration.payment.billingAddress || "",
        });
      }

      setBankDetails(instructionsResponse.data.bankDetails || null);
    } catch (_error) {
      clearAuth();
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  }, [draftRegistration, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function logout() {
    clearAuth();
    navigate("/login", { replace: true });
  }

  function updateAttendee(index, key, value) {
    setAttendees((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  }

  function updateRepresentative(key, value) {
    setRepresentative((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updatePaymentMeta(key, value) {
    setWizardPaymentMeta((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function createRegistration() {
    if (existingRegistration) {
      setError("Only one registration is allowed per account.");
      setWizardStep(5);
      return;
    }

    if (!representative.personName || !representative.designation || !representative.email || !representative.contact) {
      setError("Please complete personal details (name, designation, email, and contact number).");
      setWizardStep(1);
      return;
    }

    if (!representative.companyName || !representative.companyProfile) {
      setError("Please complete company details (company name and company profile).");
      setWizardStep(2);
      return;
    }

    if (!interestConsent) {
      setError("Please confirm your interest in the conclave and willingness to pay registration fees.");
      setWizardStep(4);
      return;
    }

    try {
      setWizardSubmitting(true);
      setError("");
      setMessage("");

      const response = await api.post("/v7m-qr/r0", {
        attendeeCount,
        attendees: visibleAttendees,
        representative,
        conclaveInterestConfirmed: true,
      });

      setDraftRegistration(response.data.registration);
      setWizardStep(5);
      setMessage("Registration created. Please complete bank transfer and upload proof.");
      await loadData();
    } catch (requestError) {
      if (requestError.response?.status === 409 && requestError.response?.data?.registration) {
        setExistingRegistration(requestError.response.data.registration);
        setDraftRegistration(requestError.response.data.registration);
        setWizardStep(5);
      }
      setError(requestError.response?.data?.message || "Failed to create registration");
    } finally {
      setWizardSubmitting(false);
    }
  }

  async function uploadProofForRegistration(registrationId, file, paymentMeta) {
    const formData = new FormData();
    formData.append("paymentProof", file);
    formData.append("transactionId", paymentMeta.transactionId);
    formData.append("paymentDate", paymentMeta.paymentDate);
    formData.append("billingAddress", paymentMeta.billingAddress);

    setWizardUploading(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/n4p-zk/f1/${registrationId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMessage("Payment proof uploaded. Verification email will be sent once admin approves.");
      await loadData();
      return true;
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to upload payment proof");
      return false;
    } finally {
      setWizardUploading(false);
    }
  }

  async function uploadWizardProof() {
    const activeRegistration = draftRegistration || existingRegistration;
    if (!activeRegistration?._id) {
      setError("Create registration first.");
      return;
    }

    if (!wizardProofFile) {
      setError("Please select a payment proof file.");
      return;
    }

    if (!wizardPaymentMeta.transactionId.trim()) {
      setError("Transaction ID is required.");
      return;
    }

    if (!wizardPaymentMeta.paymentDate) {
      setError("Payment date is required.");
      return;
    }

    if (!wizardPaymentMeta.billingAddress.trim()) {
      setError("Billing address is required.");
      return;
    }

    const success = await uploadProofForRegistration(activeRegistration._id, wizardProofFile, wizardPaymentMeta);
    if (success) {
      setWizardProofFile(null);
      navigate(`/registration/${activeRegistration._id}`);
    }
  }

  async function downloadProof(registration) {
    try {
      await downloadRegistrationProof(registration);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download proof");
    }
  }

  const activeRegistration = draftRegistration || existingRegistration;
  const hasUploadedProof = Boolean(activeRegistration?.payment?.proof?.relativePath);
  const baseAmount = Number(activeRegistration?.amount?.baseAmount || 20000);
  const gstRate = Number(activeRegistration?.amount?.gstRate ?? 0.18);
  const gstPercent = Math.round(gstRate * 100);
  const gstAmount = Number(activeRegistration?.amount?.gstAmount ?? baseAmount * gstRate);

  if (loading) {
    return <p className="px-6 py-8 text-slate-600">Loading dashboard...</p>;
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <PortalNavbar user={user} activePage="dashboard" onLogout={logout} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-7">
        <div className="border-b border-slate-100 pb-5">
          {/* <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2a5bd7]">Dashboard</p> */}
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Registration Form</h2>
          {/* <p className="mt-2 text-sm font-medium text-slate-700">{CCD_LABEL}</p> */}
        </div>

        <div className="pt-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-slate-900">Step-wise Registration</h3>
            {activeRegistration?.status && <StatusBadge status={activeRegistration.status} />}
          </div>

          <StepBar currentStep={wizardStep} />

            {existingRegistration && !hasUploadedProof && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                A registration already exists for this account. You can only upload proof or track progress.
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Representative Personal Details</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={representative.personName}
                    onChange={(event) => updateRepresentative("personName", event.target.value)}
                    placeholder="Representative Name"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                  <input
                    type="email"
                    value={representative.email}
                    onChange={(event) => updateRepresentative("email", event.target.value)}
                    placeholder="Representative Email"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                  <input
                    value={representative.contact}
                    onChange={(event) => updateRepresentative("contact", event.target.value)}
                    placeholder="Contact Number"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                  <input
                    value={representative.designation}
                    onChange={(event) => updateRepresentative("designation", event.target.value)}
                    placeholder="Designation"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0]"
                    onClick={() => setWizardStep(2)}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Company Details</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={representative.companyName}
                    onChange={(event) => updateRepresentative("companyName", event.target.value)}
                    placeholder="Company Name"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                  <input
                    value={representative.companyProfile}
                    onChange={(event) => updateRepresentative("companyProfile", event.target.value)}
                    placeholder="Company Profile"
                    className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                    required
                  />
                </div>

                <div className="h-px w-full bg-slate-200" />

                <label className="block text-sm font-semibold text-slate-700">How many people are attending? (max 5)</label>
                <select
                  value={attendeeCount}
                  onChange={(event) => setAttendeeCount(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                >
                  {[1, 2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      !fillDetailsNow
                        ? "border-[#2a5bd7] bg-[#e9f0ff] text-[#1b3f9e]"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                    onClick={() => setFillDetailsNow(false)}
                  >
                    Count Only For Now
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                      fillDetailsNow
                        ? "border-[#2a5bd7] bg-[#e9f0ff] text-[#1b3f9e]"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                    onClick={() => setFillDetailsNow(true)}
                  >
                    Fill Details Now (Optional)
                  </button>
                </div>

                <p className="text-xs text-slate-600">
                  Participant details are optional. You can proceed with only attendee count and fill details later.
                </p>

                <div className="flex justify-between">
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setWizardStep(1)}
                  >
                    Back
                  </button>
                  <button
                    className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0]"
                    onClick={() => setWizardStep(fillDetailsNow ? 3 : 4)}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 3 && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-600">
                  Fill attendee details if available. You can also skip this step and continue.
                </p>
                {visibleAttendees.map((attendee, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 text-sm font-semibold text-slate-800">Person {index + 1}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={attendee.name}
                        onChange={(event) => updateAttendee(index, "name", event.target.value)}
                        placeholder="Name"
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                      />
                      <input
                        value={attendee.email}
                        onChange={(event) => updateAttendee(index, "email", event.target.value)}
                        placeholder="Email"
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                      />
                      <input
                        value={attendee.phone}
                        onChange={(event) => updateAttendee(index, "phone", event.target.value)}
                        placeholder="Phone"
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                      />
                      <input
                        value={attendee.organization}
                        onChange={(event) => updateAttendee(index, "organization", event.target.value)}
                        placeholder="Organization"
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                      />
                      <input
                        value={attendee.designation}
                        onChange={(event) => updateAttendee(index, "designation", event.target.value)}
                        placeholder="Designation"
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7] sm:col-span-2"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between">
                  <button
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => setWizardStep(2)}
                  >
                    Back
                  </button>
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => setWizardStep(4)}
                    >
                      Skip For Now
                    </button>
                    <button
                      className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0]"
                      onClick={() => setWizardStep(4)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 4 && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">Review your registration details before submission.</p>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                  <p>
                    Company: <span className="font-semibold text-slate-900">{representative.companyName || "-"}</span>
                  </p>
                  <p className="mt-1">
                    Representative: <span className="font-semibold text-slate-900">{representative.personName || "-"}</span>
                  </p>
                  <p className="mt-1">
                    Contact: <span className="font-semibold text-slate-900">{representative.contact || "-"}</span>
                  </p>
                  <p>
                    Attendee Count: <span className="font-semibold text-slate-900">{attendeeCount}</span>
                  </p>
                  <p className="mt-1">Amount will be generated automatically based on your pricing configuration.</p>
                  <p className="mt-1 text-slate-600">
                    Participant details are optional and can be completed later.
                  </p>
                  {existingRegistration && (
                    <p className="mt-2 text-rose-700">Creation is disabled because one registration already exists.</p>
                  )}
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={interestConsent}
                    onChange={(event) => setInterestConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#2a5bd7] focus:ring-[#2a5bd7]"
                  />
                  <span>
                    I am interested in participating in this conclave and I am willing to pay the applicable
                    registration fees.
                  </span>
                </label>
                <div className="flex justify-between">
                  <div className="flex gap-2">
                    <button
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => setWizardStep(2)}
                    >
                      Back To Company Details
                    </button>
                    <button
                      className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                      onClick={() => setWizardStep(3)}
                    >
                      Participant Details (Optional)
                    </button>
                  </div>
                  <button
                    className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
                    onClick={createRegistration}
                    disabled={wizardSubmitting || Boolean(existingRegistration) || !interestConsent}
                  >
                    {existingRegistration
                      ? "Registration Already Created"
                      : wizardSubmitting
                        ? "Creating..."
                        : "Create Registration"}
                  </button>
                </div>
              </div>
            )}

            {wizardStep === 5 && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {!activeRegistration && <p className="text-sm text-slate-600">Create a registration first to upload proof.</p>}
                {activeRegistration && (
                  <>
                    {!activeRegistration.payment?.proof?.relativePath && (
                      <div className="rounded-2xl border border-[#d8e3ff] bg-[#f4f8ff] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2a5bd7]">Bank Transfer Details</p>
                        {!bankDetails && <p className="mt-2 text-sm text-slate-600">Bank details are not configured yet.</p>}
                        {bankDetails && (
                          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm text-slate-700 sm:grid-cols-2">
                            <p>
                              Account Name: <span className="font-semibold text-slate-900">{bankDetails.accountName || "-"}</span>
                            </p>
                            <p>
                              Account Number: <span className="font-semibold text-slate-900">{bankDetails.accountNumber || "-"}</span>
                            </p>
                            <p>
                              IFSC: <span className="font-semibold text-slate-900">{bankDetails.ifsc || "-"}</span>
                            </p>
                            <p>
                              Bank: <span className="font-semibold text-slate-900">{bankDetails.bankName || "-"}</span>
                            </p>
                            <p>
                              Branch: <span className="font-semibold text-slate-900">{bankDetails.branch || "-"}</span>
                            </p>
                           
                            <p className="sm:col-span-2 text-xs text-slate-600">{bankDetails.instructions}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <p>
                        Registration ID (Last 5): <span className="font-semibold text-slate-900">{formatRegistrationId(activeRegistration._id)}</span>
                      </p>
                      <p className="mt-1">
                        Payable Amount:{" "}
                        <span className="font-semibold text-slate-900">{formatMoney(activeRegistration.amount.totalAmount)}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatMoney(baseAmount)} + {gstPercent}% applicable GST ({formatMoney(gstAmount)})
                      </p>
                      <p className="mt-2">
                        Current Status: <StatusBadge status={activeRegistration.status} />
                      </p>
                    </div>

                    {activeRegistration.payment?.proof?.relativePath ? (
                      <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <p>Payment proof has already been uploaded. Continue from the progress page.</p>
                        <p>
                          Transaction ID: <span className="font-semibold">{activeRegistration.payment?.transactionId || "-"}</span>
                        </p>
                        <p>
                          Payment Date: <span className="font-semibold">{toInputDate(activeRegistration.payment?.paymentDate) || "-"}</span>
                        </p>
                        <p>
                          Billing Address: <span className="font-semibold">{activeRegistration.payment?.billingAddress || "-"}</span>
                        </p>
                        <p className="text-xs text-emerald-700/90">
                          Invoice and final confirmation details will be shared after verification.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            value={wizardPaymentMeta.transactionId}
                            onChange={(event) => updatePaymentMeta("transactionId", event.target.value)}
                            placeholder="Transaction ID"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                          />
                          <input
                            type="date"
                            value={wizardPaymentMeta.paymentDate}
                            onChange={(event) => updatePaymentMeta("paymentDate", event.target.value)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7]"
                          />
                          <textarea
                            value={wizardPaymentMeta.billingAddress}
                            onChange={(event) => updatePaymentMeta("billingAddress", event.target.value)}
                            rows={3}
                            placeholder="Billing Address"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#2a5bd7] sm:col-span-2"
                          />
                        </div>

                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                          onChange={(event) => setWizardProofFile(event.target.files?.[0] || null)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-[#e7eeff] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1f3f98]"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
                            onClick={uploadWizardProof}
                            disabled={wizardUploading || activeRegistration.status === "PAYMENT_VERIFIED"}
                          >
                            {activeRegistration.status === "PAYMENT_VERIFIED"
                              ? "Payment Already Verified"
                              : wizardUploading
                                ? "Uploading..."
                                : "Upload Payment Proof"}
                          </button>
                        </div>
                      </>
                    )}

                    {activeRegistration.payment?.proof?.relativePath && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                          onClick={() => downloadProof(activeRegistration)}
                        >
                          Download Uploaded Proof
                        </button>
                        <Link
                          className="rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700"
                          to={`/registration/${activeRegistration._id}`}
                        >
                          View Progress
                        </Link>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

          {message && (
            <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {message}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
          )}
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
