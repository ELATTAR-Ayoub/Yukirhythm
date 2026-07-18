import DataText from "@/components/studio/DataText";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

/** One listening-behavior number, framed. */
export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-label text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <DataText className="block text-2xl text-primary mt-1.5">{value}</DataText>
      {hint ? (
        <div className="text-xs text-muted-foreground mt-1">{hint}</div>
      ) : null}
    </div>
  );
}
