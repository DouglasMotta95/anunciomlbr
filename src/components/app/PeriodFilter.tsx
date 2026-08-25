import { Calendar } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PERIOD_OPTIONS, type PeriodKey } from "@/lib/period";

export function PeriodFilter({
  value,
  onChange,
  custom,
  onCustomChange,
}: {
  value: PeriodKey;
  onChange: (value: PeriodKey) => void;
  custom: { from: string; to: string };
  onCustomChange: (custom: { from: string; to: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value} onValueChange={(v) => onChange(v as PeriodKey)}>
        <SelectTrigger className="w-[190px]">
          <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "custom" && (
        <>
          <Input
            type="date"
            className="w-[150px]"
            value={custom.from}
            onChange={(e) => onCustomChange({ ...custom, from: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="w-[150px]"
            value={custom.to}
            onChange={(e) => onCustomChange({ ...custom, to: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
