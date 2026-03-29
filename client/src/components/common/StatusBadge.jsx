import { formatStatus, statusClass } from "../../utils/formatters";

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${statusClass(status)}`}
    >
      {formatStatus(status)}
    </span>
  );
}

export default StatusBadge;
