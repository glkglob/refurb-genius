/**
 * Pure raw package artifact checksum for measured-BOQ catalogue dry-run (B1B).
 * Artifact identity — not logical catalogue content identity.
 * No filesystem, network, or Supabase.
 */

import { sha256Hex } from "./sha256";

/**
 * Domain separator for package artifact digests.
 * Changing this value invalidates all prior input checksums.
 */
export const PACKAGE_ARTIFACT_DOMAIN = "mboq-package-v1\n";

/**
 * Compute SHA-256 (lowercase hex) of raw package artifacts.
 *
 * Encoding (exact):
 * ```
 * mboq-package-v1\n
 * MANIFEST.json\n
 * <manifestText>\n
 * snapshot.json\n
 * <snapshotText>\n
 * ```
 *
 * Byte-sensitive: CRLF vs LF, BOM, indentation, key order, and trailing
 * newlines in either artifact change the digest. Callers should pass UTF-8
 * text as already loaded (B1C reads files; B1B stays pure).
 */
export function computePackageArtifactChecksum(manifestText: string, snapshotText: string): string {
  const payload =
    PACKAGE_ARTIFACT_DOMAIN +
    "MANIFEST.json\n" +
    manifestText +
    "\n" +
    "snapshot.json\n" +
    snapshotText +
    "\n";
  return sha256Hex(payload);
}
