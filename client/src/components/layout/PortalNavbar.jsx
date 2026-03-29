import { CCD_LABEL, IITG_LOGO_URL } from "../../constants/branding";

function PortalNavbar({ user, activePage, onLogout }) {
  const isAdminPage = activePage === "admin";

  return (
    <header className="mb-6 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src={IITG_LOGO_URL}
            alt="IIT Guwahati logo"
            className="h-16 w-16 rounded-full border border-slate-200 bg-white p-1 object-contain"
          />
          <div>
            <p className="text-xl font-semibold leading-tight text-slate-900 sm:text-4xl">Industry Conclave 2026</p>
            <p className="text-sm text-slate-500 sm:text-lg">{CCD_LABEL}</p>
            {isAdminPage && <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#2a5bd7]">Admin Verification</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-slate-900">{user?.name || "Participant"}</p>
            <p className="text-xs text-slate-500">{user?.email || "-"}</p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#2a5bd7] hover:text-[#2a5bd7]"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

export default PortalNavbar;
