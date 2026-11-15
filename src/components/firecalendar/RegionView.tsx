import { REGIONS, useRegionCalendar, type Region } from "../../lib/firecalendar";
import { CalendarGrid, CalendarSkeleton } from "./CalendarGrid";
import { Legend, SeasonLine } from "./Legend";
import { regionEn } from "./ContinuityChart";
import { LoadError } from "./States";

export function RegionTabs({ value, onChange }: { value: Region; onChange: (r: Region) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Region">
      {REGIONS.map((r) => (
        <button key={r} role="tab" type="button" aria-selected={value === r} onClick={() => onChange(r)}>
          {regionEn(r)}
        </button>
      ))}
    </div>
  );
}

export function RegionView({ region, showModis = false }: { region: Region; showModis?: boolean }) {
  const q = useRegionCalendar(region);
  if (q.isPending) return <CalendarSkeleton />;
  if (q.isError) return <LoadError error={q.error} onRetry={() => void q.refetch()} />;
  return (
    <div role="tabpanel" aria-label={regionEn(region)}>
      <SeasonLine season={q.data.season} />
      <CalendarGrid rows={q.data.rows} showModis={showModis} label={`Fire calendar ${regionEn(region)} 2001–2024`} />
      <Legend showModis={showModis} />
    </div>
  );
}