import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { CCD_LABEL, CONCLAVE_DATES, IITG_LOGO_URL } from "../constants/branding";
import { saveAuth } from "../utils/authStorage";

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debugOtp, setDebugOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "" });
  const [otp, setOtp] = useState("");

  useEffect(() => {
    setMessage("");
    setError("");
    setDebugOtp("");
    setOtpSent(false);
    setOtp("");
  }, [mode]);

  async function requestOtp(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const email = mode === "login" ? loginForm.email : registerForm.email;
      const purpose = mode === "login" ? "login" : "register";

      const response = await api.post("/auth/request-otp", {
        email,
        purpose,
      });

      setOtpSent(true);
      setDebugOtp(response.data.debugOtp || "");
      setMessage("OTP sent to your email. Please enter it below.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      let response;
      if (mode === "login") {
        response = await api.post("/auth/verify-otp-login", {
          email: loginForm.email,
          otp,
        });
      } else {
        response = await api.post("/auth/verify-otp-register", {
          ...registerForm,
          otp,
        });
      }

      saveAuth(response.data.token);
      const targetPath = response.data.user?.role === "admin" ? "/admin" : "/dashboard";
      navigate(targetPath);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-6xl content-center gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-[#bfd0ff] bg-gradient-to-br from-[#1f4fca] via-[#2459d4] to-[#2d67dd] p-7 text-white shadow-[0_30px_60px_rgba(37,88,209,0.35)]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[#7ea7ff]/25" />

        <div className="flex items-center gap-3">
          <img
            src={IITG_LOGO_URL}
            alt="IIT Guwahati logo"
            className="h-24 w-24 rounded-full border border-white/35 bg-white/10 p-2 object-contain"
          />
          <div>
            <p className="text-xl font-semibold uppercase tracking-[0.24em] text-[#d7e4ff]">Industry Conclave 2026</p>
            <p className="mt-0.5 text-xs font-medium text-[#e3edff]">{CCD_LABEL}</p>
          </div>
        </div>
        <h2 className="mt-3 max-w-md text-4xl font-semibold leading-[1.05]">
          Empowering Industry. <br />
          Bridging Ideas.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-[#e5edff]">
          Register your organization for IIT Guwahati Industry Conclave. Complete onboarding, submit participant
          details, transfer fees, and upload payment proof for approval.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/25 bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#dce8ff]">Venue</p>
            <p className="mt-1 text-sm font-semibold">IIT Guwahati Campus</p>
          </div>
          <div className="rounded-2xl border border-white/25 bg-white/10 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#dce8ff]">Dates</p>
            <p className="mt-1 text-sm font-semibold">{CONCLAVE_DATES}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#2a5bd7]">{CCD_LABEL}</p>
        <div className="mb-5 grid grid-cols-2 gap-2 text-sm font-semibold">
          <Link
            to="/login"
            className={`rounded-xl px-4 py-2.5 text-center transition ${mode === "login" ? "bg-[#2a5bd7] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Login
          </Link>
          <Link
            to="/register"
            className={`rounded-xl px-4 py-2.5 text-center transition ${mode === "register" ? "bg-[#2a5bd7] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            Register
          </Link>
        </div>

        <div className="min-h-[14rem] rounded-2xl border border-slate-100 bg-slate-50/55 p-3.5 sm:p-4">
          {mode === "login" && (
            <form className="space-y-3" onSubmit={otpSent ? verifyOtp : requestOtp}>
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#2a5bd7]"
                required
              />

              {otpSent && (
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#2a5bd7]"
                  required
                />
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2a5bd7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
              >
                {loading ? "Please wait..." : otpSent ? "Verify OTP & Login" : "Send OTP"}
              </button>
            </form>
          )}

          {mode === "register" && (
            <form className="space-y-3" onSubmit={otpSent ? verifyOtp : requestOtp}>
              <input
                type="text"
                placeholder="Full Name"
                value={registerForm.name}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#2a5bd7]"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#2a5bd7]"
                required
              />

              {otpSent && (
                <input
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-[#2a5bd7]"
                  required
                />
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#2a5bd7] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2049b0] disabled:opacity-60"
              >
                {loading ? "Please wait..." : otpSent ? "Verify OTP & Register" : "Send OTP"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Authentication is OTP-based for both login and registration.
        </p>

        {message && (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {debugOtp && <p className="mt-2 text-xs text-slate-500">Development OTP: {debugOtp}</p>}
      </section>
    </div>
  );
}

export default AuthPage;
