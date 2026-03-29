function ProgressLine({ title, done, muted }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? "bg-emerald-100 text-emerald-700"
            : muted
              ? "bg-slate-100 text-slate-400"
              : "bg-[#e7eeff] text-[#2a5bd7]"
        }`}
      >
        {done ? "✓" : "•"}
      </span>
      <p className={`text-sm ${done ? "text-slate-800" : muted ? "text-slate-400" : "text-slate-600"}`}>{title}</p>
    </div>
  );
}

export default ProgressLine;
