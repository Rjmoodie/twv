import { PROVENANCE, type ProvenanceKind } from "@/lib/provenance";

interface DataSourceTagProps {
  kind: ProvenanceKind;
  /** Extra precision appended to the tooltip, e.g. "FY2024 10-K". */
  note?: string;
  className?: string;
}

/**
 * A deliberately quiet provenance marker.
 *
 * Sits beside a figure or a section heading and answers one question: is this a
 * number the company filed, a number the market set, or a number we worked out?
 * Muted, uppercase, no background — it should read as a footnote, not a badge,
 * so it can appear often without competing with the data.
 */
const DataSourceTag = ({ kind, note, className = "" }: DataSourceTagProps) => {
  const meta = PROVENANCE[kind];
  const title = note ? `${meta.detail} (${note})` : meta.detail;

  return (
    <span
      title={title}
      aria-label={title}
      className={[
        "inline-flex shrink-0 items-center gap-1 align-middle",
        "font-mono text-[9px] font-medium uppercase tracking-[0.09em]",
        "text-muted-foreground/70",
        "cursor-help border-b border-dotted border-muted-foreground/30",
        className,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
};

export default DataSourceTag;
