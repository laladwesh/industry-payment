import { wizardSteps } from "../../constants/registration";

function StepBar({ currentStep }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {wizardSteps.map((item, index) => {
        const step = index + 1;
        const active = currentStep === step;
        const complete = currentStep > step;

        return (
          <div
            key={item.title}
            className={`rounded-2xl border px-4 py-3 text-left transition ${
              active
                ? "border-[#2a5bd7] bg-[#e9f0ff]"
                : complete
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                active
                  ? "text-[#1f3f98]"
                  : complete
                    ? "text-emerald-700"
                    : "text-slate-500"
              }`}
            >
              Step {step}
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                active
                  ? "text-[#17357d]"
                  : complete
                    ? "text-emerald-800"
                    : "text-slate-700"
              }`}
            >
              {item.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.caption}</p>
          </div>
        );
      })}
    </div>
  );
}

export default StepBar;
