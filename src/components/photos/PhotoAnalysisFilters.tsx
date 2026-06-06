"use client";

import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
} from "@repo/ui";

export interface PhotoAnalysisFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  roomFilter: string;
  setRoomFilter: (v: string) => void;
  severityFilter: string;
  setSeverityFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  statusFilter: "all" | "analyzed" | "unanalyzed";
  setStatusFilter: (v: "all" | "analyzed" | "unanalyzed") => void;
  availableRooms: string[];
  availableCategories: string[];
}

const SEVERITIES = ["all", "high", "medium", "low"] as const;

export function PhotoAnalysisFilters({
  search,
  setSearch,
  roomFilter,
  setRoomFilter,
  severityFilter,
  setSeverityFilter,
  categoryFilter,
  setCategoryFilter,
  statusFilter,
  setStatusFilter,
  availableRooms,
  availableCategories,
}: PhotoAnalysisFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 p-4 bg-muted/30 rounded-lg">
      <Input
        placeholder="Search defects, materials, reports..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-64"
      />

      <Select value={roomFilter} onValueChange={setRoomFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Room" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Rooms</SelectItem>
          {availableRooms.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={severityFilter} onValueChange={setSeverityFilter}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          {SEVERITIES.map((s) => (
            <SelectItem key={s} value={s}>
              {s === "all" ? "All Severities" : s.charAt(0).toUpperCase() + s.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {availableCategories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-1 items-center">
        {(["all", "analyzed", "unanalyzed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
          >
            <Badge
              variant={statusFilter === s ? "default" : "outline"}
              className="cursor-pointer capitalize pointer-events-none"
            >
              {s}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
