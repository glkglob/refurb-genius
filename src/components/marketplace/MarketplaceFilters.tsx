"use client";

import { Input } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { Slider } from "@repo/ui";
import { Search } from "lucide-react";

interface MarketplaceFiltersProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  specialtyFilter: string;
  setSpecialtyFilter: (v: string) => void;
  postcodeFilter: string;
  setPostcodeFilter: (v: string) => void;
  minRating: number;
  setMinRating: (v: number) => void;
}

const COMMON_SPECIALTIES = [
  "All",
  "Plumbing",
  "Electrical",
  "Roofing",
  "Carpentry",
  "Painting",
  "Heating",
  "Flooring",
  "Plastering",
  "General Building",
  "Landscaping",
  "Other",
];

export function MarketplaceFilters({
  searchTerm,
  setSearchTerm,
  specialtyFilter,
  setSpecialtyFilter,
  postcodeFilter,
  setPostcodeFilter,
  minRating,
  setMinRating,
}: MarketplaceFiltersProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search name, bio, or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Specialty" />
        </SelectTrigger>
        <SelectContent>
          {COMMON_SPECIALTIES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Postcode / area (e.g. SW1, Manchester)"
        value={postcodeFilter}
        onChange={(e) => setPostcodeFilter(e.target.value)}
      />

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Min rating</span>
          <span>{minRating.toFixed(1)}+</span>
        </div>
        <Slider
          value={[minRating]}
          onValueChange={([v]) => setMinRating(v)}
          min={0}
          max={5}
          step={0.5}
          className="w-full"
        />
      </div>
    </div>
  );
}
