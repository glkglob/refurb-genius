// Profile — user profile row from `profiles` table.
export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
  default_region: string | null;
  created_at: string;
};
