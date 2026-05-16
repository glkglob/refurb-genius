import { supabase } from "@/integrations/supabase/client";
import type { TradeProfile, UpsertTradeProfileInput, InsuranceStatus } from "@/core/trades";

type TradeProfileRow = {
  user_id: string;
  business_name: string;
  contact_name: string;
  phone: string | null;
  postcode: string | null;
  trade_categories: string[];
  bio: string | null;
  insurance_status: string;
  created_at: string;
  updated_at: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("trade_profiles");

function rowToProfile(r: TradeProfileRow): TradeProfile {
  return {
    userId: r.user_id,
    businessName: r.business_name,
    contactName: r.contact_name,
    phone: r.phone,
    postcode: r.postcode,
    tradeCategories: r.trade_categories ?? [],
    bio: r.bio,
    insuranceStatus: r.insurance_status as InsuranceStatus,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function getCurrentUserTradeProfile(): Promise<TradeProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await table().select("*").eq("user_id", userData.user.id).maybeSingle();

  if (error) throw new Error(`getCurrentUserTradeProfile: ${error.message}`);
  return data ? rowToProfile(data as TradeProfileRow) : null;
}

export async function getTradeProfileByUserId(userId: string): Promise<TradeProfile | null> {
  const { data, error } = await table().select("*").eq("user_id", userId).maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToProfile(data as TradeProfileRow) : null;
}

export async function upsertCurrentUserTradeProfile(
  input: UpsertTradeProfileInput,
): Promise<TradeProfile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Not authenticated");

  const { data, error } = await table()
    .upsert(
      {
        user_id: userData.user.id,
        business_name: input.businessName,
        contact_name: input.contactName,
        phone: input.phone ?? null,
        postcode: input.postcode ?? null,
        trade_categories: input.tradeCategories ?? [],
        bio: input.bio ?? null,
        insurance_status: input.insuranceStatus ?? "unknown",
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (error) throw new Error(`upsertCurrentUserTradeProfile: ${error.message}`);
  return rowToProfile(data as TradeProfileRow);
}
