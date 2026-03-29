import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import ProgressLine from "../components/common/ProgressLine";
import StatusBadge from "../components/common/StatusBadge";
import PortalNavbar from "../components/layout/PortalNavbar";
import { emptyAttendee } from "../constants/registration";
import { clearAuth } from "../utils/authStorage";
import { formatMoney } from "../utils/formatters";
import { downloadRegistrationProof } from "../utils/proofDownload";

function buildAttendeeDrafts(registration) {
  const attendeeCount = Number(registration?.attendeeCount || 0);
  return Array.from({ length: attendeeCount }, (_, index) => ({
    ...emptyAttendee,
    ...(registration?.attendees?.[index] || {}),
  }));
}

function RegistrationProgressPage() {
  const navigate = useNavigate();
  const { registrationId } = useParams();
  const [user, setUser] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingParticipants, setEditingParticipants] = useState(false);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [attendeeDrafts, setAttendeeDrafts] = useState([]);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");
      const [statusResponse, meResponse] = await Promise.all([
        api.get(`/payments/status/${registrationId}`),
        api.get("/auth/me"),
      ]);
      const nextRegistration = statusResponse.data.registration;
      setRegistration(nextRegistration);
      setAttendeeDrafts(buildAttendeeDrafts(nextRegistration));
      setEditingParticipants(false);
      setUser(meResponse.data.user || null);
    } catch (requestError) {
      if (requestError.response?.status === 401) {
        clearAuth();
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError.response?.data?.message || "Failed to load progress");
    } finally {
      setLoading(false);
    }
  }, [navigate, registrationId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function downloadProof() {
    if (!registration) {
      return;
    }

    try {
      setMessage("");
      await downloadRegistrationProof(registration);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download proof");
    }
  }

  function updateAttendee(index, key, value) {
    setAttendeeDrafts((prev) => {
      const next = [...prev];
      next[index] = {
        ...(next[index] || emptyAttendee),
        [key]: value,
      };
      return next;
    });
  }

  function cancelParticipantEditing() {
    setAttendeeDrafts(buildAttendeeDrafts(registration));
    setEditingParticipants(false);
  }

  async function saveParticipantDetails() {
    if (!registration?._id) {
      return;
    }

    try {
      setSavingParticipants(true);
      setError("");
      setMessage("");

      const response = await api.patch(`/registrations/${registration._id}/attendees`, {
        attendees: attendeeDrafts,
      });

      const updated = response.data.registration;
      setRegistration(updated);
      setAttendeeDrafts(buildAttendeeDrafts(updated));
      setEditingParticipants(false);
      setMessage(response.data.message || "Participant details updated successfully.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to update participant details");
    } finally {
      setSavingParticipants(false);
    }
  }

  if (loading) {
    return <p className="px-6 py-8 text-slate-600">Loading progress...</p>;
  }

  const proofUploaded = Boolean(registration?.payment?.proof?.relativePath);
  const verified = registration?.status === "PAYMENT_VERIFIED";
  const filledParticipants = attendeeDrafts.filter(
    (attendee) => attendee.name || attendee.email || attendee.phone || attendee.organization || attendee.designation
  ).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <PortalNavbar
        user={user}
        activePage="progress"
        onLogout={() => {
          clearAuth();
          navigate("/login", { replace: true });
        }}
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <h2 className="text-2xl font-semibold text-slate-900">Registration Progress</h2>
        {message && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

          {registration && (
            <>
              <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                <p>
                  Registration ID: <span className="font-semibold text-slate-900">{registration._id}</span>
                </p>
                <p>
                  Amount: <span className="font-semibold text-slate-900">{formatMoney(registration.amount.totalAmount)}</span>
                </p>
                <p>
                  Company: <span className="font-semibold text-slate-900">{registration.representative?.companyName || "-"}</span>
                </p>
                <p>
                  Representative: <span className="font-semibold text-slate-900">{registration.representative?.personName || "-"}</span>
                </p>
                <p className="sm:col-span-2">
                  Status: <StatusBadge status={registration.status} />
                </p>
              </div>

              {proofUploaded && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Payment Metadata</p>
                  <p className="mt-2">
                    Transaction ID: <span className="font-semibold text-slate-900">{registration.payment?.transactionId || "-"}</span>
                  </p>
                  <p>
                    Payment Date: <span className="font-semibold text-slate-900">{registration.payment?.paymentDate ? new Date(registration.payment.paymentDate).toLocaleDateString() : "-"}</span>
                  </p>
                  <p>
                    Billing Address: <span className="font-semibold text-slate-900">{registration.payment?.billingAddress || "-"}</span>
                  </p>
                </div>
              )}

              <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <ProgressLine title="Registration created" done />
                <ProgressLine title="Payment proof uploaded" done={proofUploaded} muted={!proofUploaded && !verified} />
                <ProgressLine title="Payment verified by admin" done={verified} muted={!verified} />
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Participant Details</p>
                  {!editingParticipants && attendeeDrafts.length > 0 && (
                    <button
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#2a5bd7] hover:text-[#2a5bd7]"
                      onClick={() => setEditingParticipants(true)}
                    >
                      Fill / Update Participant Details
                    </button>
                  )}
                </div>

                {!editingParticipants && attendeeDrafts.length > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    Filled participants: <span className="font-semibold text-slate-900">{filledParticipants}</span> / {attendeeDrafts.length}
                  </p>
                )}

                {!editingParticipants && attendeeDrafts.length === 0 && (
                  <p className="mt-2 text-sm text-slate-600">No participant slots available for this registration.</p>
                )}

                {editingParticipants && (
                  <div className="mt-3 space-y-3">
                    {attendeeDrafts.map((attendee, index) => (
                      <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="mb-3 text-sm font-semibold text-slate-800">Participant {index + 1}</p>
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

                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
                        onClick={saveParticipantDetails}
                        disabled={savingParticipants}
                      >
                        {savingParticipants ? "Saving..." : "Save Participant Details"}
                      </button>
                      <button
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                        onClick={cancelParticipantEditing}
                        disabled={savingParticipants}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-[#2a5bd7] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2049b0]"
              onClick={fetchStatus}
            >
              Refresh
            </button>
            {registration?.payment?.proof?.relativePath && (
              <button
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={downloadProof}
              >
                Download Proof
              </button>
            )}
            <Link className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" to="/dashboard">
              Back to Dashboard
            </Link>
          </div>
      </div>
    </div>
  );
}

export default RegistrationProgressPage;
