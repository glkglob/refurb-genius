import { useQuery } from "@tanstack/react-query";
import type { Project } from "@repo/types";
import { supabase } from "@/platform/supabase/browser";

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  address: string | null;
  postcode: string | null;
  region: Project["region"];
  property_type: Project["property_type"];
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  purchase_price: number | null;
  estimated_gdv: number | null;
  notes: string | null;
  created_at: string;
  status: Project["status"] | null;
  property_condition?: Project["property_condition"];
  refurbishment_level?: Project["refurbishment_level"];
  updated_at?: string | null;
};

async function fetchProjectCatalog(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data as ProjectRow[]).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    address: row.address ?? "",
    postcode: row.postcode ?? "",
    region: row.region,
    property_type: row.property_type,
    bedrooms: Number(row.bedrooms ?? 0),
    bathrooms: Number(row.bathrooms ?? 0),
    size_sqm: Number(row.size_sqm ?? 0),
    purchase_price: Number(row.purchase_price ?? 0),
    estimated_gdv: Number(row.estimated_gdv ?? 0),
    notes: row.notes ?? "",
    created_at: row.created_at,
    status: row.status ?? "Draft",
    property_condition: row.property_condition,
    refurbishment_level: row.refurbishment_level,
    updated_at: row.updated_at ?? undefined,
  }));
}

export function useProjectCatalog() {
  return useQuery({
    queryKey: ["project-catalog"],
    queryFn: fetchProjectCatalog,
  });
}
