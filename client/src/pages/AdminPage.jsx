import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import StatusBadge from "../components/common/StatusBadge";
import PortalNavbar from "../components/layout/PortalNavbar";
import { clearAuth } from "../utils/authStorage";
import { formatMoney } from "../utils/formatters";
import { downloadRegistrationProof } from "../utils/proofDownload";

function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [registrations, setRegistrations] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [remarks, setRemarks] = useState({});
  const [processingId, setProcessingId] = useState("");
  const [maxRegistrations, setMaxRegistrations] = useState(0);
  const [currentCount, setCurrentCount] = useState(0);
  const [isClosed, setIsClosed] = useState(false);
  const [updatingLimit, setUpdatingLimit] = useState(false);
  const [expandedRegistrationId, setExpandedRegistrationId] = useState("");

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const meResponse = await api.get("/x9a-kk/p3");
      setUser(meResponse.data.user || null);
      if (meResponse.data.user?.role !== "admin") {
        navigate("/dashboard", { replace: true });
        return;
      }

      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const [registrationsResponse, limitResponse] = await Promise.all([
        api.get(`/n4p-zk/f4${query}`),
        api.get("/v7m-qr/r4"),
      ]);

      setRegistrations(registrationsResponse.data.registrations || []);
      setMaxRegistrations(Number(limitResponse.data.maxRegistrations || 0));
      setCurrentCount(Number(limitResponse.data.currentCount || 0));
      setIsClosed(Boolean(limitResponse.data.closed));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load admin registrations");
    } finally {
      setLoading(false);
    }
  }, [navigate, statusFilter]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  async function verifyPayment(registrationId) {
    try {
      setProcessingId(registrationId);
      setError("");
      setMessage("");

      await api.post(`/n4p-zk/f5/${registrationId}`, {
        remark: remarks[registrationId] || "",
      });

      setMessage("Payment verified and notification email sent.");
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to verify payment");
    } finally {
      setProcessingId("");
    }
  }

  async function downloadProof(registration) {
    try {
      await downloadRegistrationProof(registration);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download proof");
    }
  }

  async function updateRegistrationLimit() {
    try {
      setUpdatingLimit(true);
      setError("");
      setMessage("");

      const response = await api.put("/v7m-qr/r4", {
        maxRegistrations,
      });

      setCurrentCount(Number(response.data.currentCount || 0));
      setIsClosed(Boolean(response.data.closed));
      setMessage(response.data.message || "Registration limit updated successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to update registration limit");
    } finally {
      setUpdatingLimit(false);
    }
  }

  function toggleRegistrationDetails(registrationId) {
    setExpandedRegistrationId((prev) => (prev === registrationId ? "" : registrationId));
  }

  if (loading) {
    return <p className="px-6 py-8 text-slate-600">Loading admin panel...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <PortalNavbar
        user={user}
        activePage="admin"
        onLogout={() => {
          clearAuth();
          navigate("/login", { replace: true });
        }}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Registration Cap Control</p>
          <p className="mt-1 text-xs text-slate-600">
            Set to 0 for unlimited registrations. Form auto-closes when current registrations reach the set limit.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Max Registrations
            </label>
            <input
              type="number"
              min={0}
              value={maxRegistrations}
              onChange={(event) => setMaxRegistrations(Math.max(0, Number(event.target.value || 0)))}
              className="w-40 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2a5bd7]"
            />
            <button
              className="rounded-xl bg-[#2a5bd7] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
              onClick={updateRegistrationLimit}
              disabled={updatingLimit}
            >
              {updatingLimit ? "Updating..." : "Update Limit"}
            </button>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            Current registrations: <span className="font-semibold">{currentCount}</span>
          </p>
          <p className={`mt-1 text-sm font-semibold ${isClosed ? "text-rose-700" : "text-emerald-700"}`}>
            {isClosed ? "Registration is currently CLOSED" : "Registration is currently OPEN"}
          </p>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">Admin Payment Verification</h2>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#2a5bd7]"
          >
            <option value="">All Statuses</option>
            <option value="PENDING_PROOF">Payment Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="PAYMENT_VERIFIED">Payment Verified</option>
          </select>
        </div>

          {message && <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
          {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          <div className="space-y-3">
            {registrations.length === 0 && <p className="text-sm text-slate-500">No registrations found.</p>}
            {registrations.map((registration) => (
              <div key={registration._id} className="rounded-2xl border border-slate-200 p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
                  <div className="space-y-1 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Registration: {registration._id}</p>
                    <p>
                      User: {registration.user?.name || "-"} ({registration.user?.email || "-"})
                    </p>
                    <p>Attendees: {registration.attendeeCount}</p>
                    <p>Amount: {formatMoney(registration.amount.totalAmount)}</p>
                    <StatusBadge status={registration.status} />
                    {registration.payment?.proof?.originalName && (
                      <p className="text-xs text-slate-500">Proof: {registration.payment.proof.originalName}</p>
                    )}

                    <button
                      className="mt-2 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#2a5bd7] hover:text-[#2a5bd7]"
                      onClick={() => toggleRegistrationDetails(registration._id)}
                    >
                      {expandedRegistrationId === registration._id ? "Hide Full Details" : "View Full Details"}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {registration.payment?.proof?.relativePath && (
                      <button
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700"
                        onClick={() => downloadProof(registration)}
                      >
                        Download Proof
                      </button>
                    )}

                    {registration.status !== "PAYMENT_VERIFIED" && (
                      <>
                        <textarea
                          value={remarks[registration._id] || ""}
                          onChange={(event) =>
                            setRemarks((prev) => ({
                              ...prev,
                              [registration._id]: event.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Optional remark"
                          className="rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-[#2a5bd7]"
                        />
                        <button
                          className="rounded-xl bg-[#2a5bd7] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
                          onClick={() => verifyPayment(registration._id)}
                          disabled={processingId === registration._id}
                        >
                          {processingId === registration._id ? "Verifying..." : "Verify Payment"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expandedRegistrationId === registration._id && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="text-sm font-semibold text-slate-900">Complete Registration Details</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <p>
                        Company: <span className="font-semibold text-slate-900">{registration.representative?.companyName || "-"}</span>
                      </p>
                      <p>
                        Representative: <span className="font-semibold text-slate-900">{registration.representative?.personName || "-"}</span>
                      </p>
                      <p>
                        Designation: <span className="font-semibold text-slate-900">{registration.representative?.designation || "-"}</span>
                      </p>
                      <p>
                        Representative Email: <span className="font-semibold text-slate-900">{registration.representative?.email || "-"}</span>
                      </p>
                      <p>
                        Contact: <span className="font-semibold text-slate-900">{registration.representative?.contact || "-"}</span>
                      </p>
                      <p>
                        Company Profile: <span className="font-semibold text-slate-900">{registration.representative?.companyProfile || "-"}</span>
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Attendees</p>
                      {(registration.attendees || []).length === 0 && <p className="mt-2 text-sm text-slate-500">No attendee details submitted.</p>}
                      {(registration.attendees || []).map((attendee, index) => (
                        <div key={`${registration._id}-attendee-${index}`} className="mt-2 rounded-lg border border-slate-200 p-2">
                          <p className="font-semibold text-slate-900">Attendee {index + 1}</p>
                          <div className="mt-1 grid gap-1 sm:grid-cols-2">
                            <p>Name: {attendee.name || "-"}</p>
                            <p>Email: {attendee.email || "-"}</p>
                            <p>Phone: {attendee.phone || "-"}</p>
                            <p>Organization: {attendee.organization || "-"}</p>
                            <p className="sm:col-span-2">Designation: {attendee.designation || "-"}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <p>
                        Base Amount: <span className="font-semibold text-slate-900">{formatMoney(registration.amount?.baseAmount)}</span>
                      </p>
                      <p>
                        GST Amount: <span className="font-semibold text-slate-900">{formatMoney(registration.amount?.gstAmount)}</span>
                      </p>
                      <p>
                        Platform Charge: <span className="font-semibold text-slate-900">{formatMoney(registration.amount?.platformCharge)}</span>
                      </p>
                      <p>
                        Total Amount: <span className="font-semibold text-slate-900">{formatMoney(registration.amount?.totalAmount)}</span>
                      </p>
                      <p>
                        Transaction ID: <span className="font-semibold text-slate-900">{registration.payment?.transactionId || "-"}</span>
                      </p>
                      <p>
                        Payment Date:{" "}
                        <span className="font-semibold text-slate-900">
                          {registration.payment?.paymentDate ? new Date(registration.payment.paymentDate).toLocaleDateString() : "-"}
                        </span>
                      </p>
                      <p className="sm:col-span-2">
                        Billing Address: <span className="font-semibold text-slate-900">{registration.payment?.billingAddress || "-"}</span>
                      </p>
                      <p>
                        Payment State: <span className="font-semibold text-slate-900">{registration.payment?.state || "-"}</span>
                      </p>
                      <p>
                        Verified By: <span className="font-semibold text-slate-900">{registration.payment?.verifiedBy?.email || "-"}</span>
                      </p>
                      <p className="sm:col-span-2">
                        Admin Remark: <span className="font-semibold text-slate-900">{registration.payment?.adminRemark || "-"}</span>
                      </p>
                      <p>
                        Created At:{" "}
                        <span className="font-semibold text-slate-900">
                          {registration.createdAt ? new Date(registration.createdAt).toLocaleString() : "-"}
                        </span>
                      </p>
                      <p>
                        Updated At:{" "}
                        <span className="font-semibold text-slate-900">
                          {registration.updatedAt ? new Date(registration.updatedAt).toLocaleString() : "-"}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
      </div>
    </div>
  );
}

export default AdminPage;
