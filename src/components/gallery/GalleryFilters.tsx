"use client";

import { Input } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Search } from "lucide-react";

export interface GalleryFiltersProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  regionFilter: string;
  setRegionFilter: (v: string) => void;
  minGdv: number;
  setMinGdv: (v: number) => void;
  minRoi: number;
  setMinRoi: (v: number) => void;
  availableRegions: string[];
}

const ROI_OPTIONS = [0, 10, 20, 30, 40, 50];

export function GalleryFilters({
  searchTerm,
  setSearchTerm,
  regionFilter,
  setRegionFilter,
  minGdv,
  setMinGdv,
  minRoi,
  setMinRoi,
  availableRegions,
}: GalleryFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6 p-4 bg-muted/30 rounded-lg border">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search title, description, location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={regionFilter} onValueChange={setRegionFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Region / Location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          {availableRegions.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Min GDV</span>
          <span>£{(minGdv / 1000).toFixed(0)}k+</span>
        </div>
        <Slider
          value={[minGdv]}
          onValueChange={([v]) => setMinGdv(v)}
          min={100000}
          max={2000000}
          step={50000}
        />
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Min ROI</span>
          <span>{minRoi}%+</span>
        </div>
        <div className="flex gap-2">
          {ROI_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setMinRoi(r)}
              className={`px-2 py-1 text-xs rounded border ${minRoi === r ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {r}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
