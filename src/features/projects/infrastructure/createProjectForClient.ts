/**
 * Platform-aware project create (IOS-READINESS-2C-3).
 *
 * Web: cookie createProjectServerFn.
 * Native: Keychain createProjectNative. user_id never comes from the payload.
 */
import { Capacitor } from "@capacitor/core";
import type { NewProjectInput } from "@/core/projects/domain";
import { rowToProject, type ProjectWithProgress } from "@/lib/mappers";
import { createProjectServerFn } from "@/serverFns/projects";

export async function createProjectForClient(input: NewProjectInput): Promise<ProjectWithProgress> {
  if (Capacitor.isNativePlatform()) {
    const { createProjectNative } = await import("@/platform/supabase/native-projects");
    const row = await createProjectNative({
      name: input.name,
      address: input.address,
      postcode: input.postcode,
      region: input.region,
      property_type: input.property_type,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      size_sqm: input.size_sqm,
      purchase_price: input.purchase_price,
      estimated_gdv: input.estimated_gdv,
      notes: input.notes,
    });
    return rowToProject(row);
  }

  return createProjectServerFn({ data: input });
}
