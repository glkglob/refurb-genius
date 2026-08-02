/**
 * Pure raw package artifact checksum for measured-BOQ catalogue dry-run (B1B).
 * Artifact identity — not logical catalogue content identity.
 * No filesystem, network, or Supabase.
 *
 * Framing v2 is injective over the pair of UTF-8 artifact strings: each
 * artifact is hashed independently, then the ordered pair of digests is hashed
 * under a versioned domain separator. Delimiter text inside either JSON body
 * cannot recreate another pair's preimage (unlike the retired v1 concatenation
 * that lived only in historical B1B builds and is reconstructed solely in tests).
 */

import { sha256Hex } from "./sha256";

/**
 * Active package artifact checksum domain (v2 injective framing).
 * Changing this value invalidates all prior inputChecksum values.
 */
export const PACKAGE_ARTIFACT_DOMAIN = "mboq-package-v2\n";

/**
 * Compute SHA-256 (lowercase hex) of raw package artifacts.
 *
 * Encoding (exact, injective):
 * ```
 * mboq-package-v2\n
 * manifest:<sha256Hex(manifestText)>\n
 * snapshot:<sha256Hex(snapshotText)>\n
 * ```
 *
 * Each of `manifestText` and `snapshotText` is digested as UTF-8 via the
 * shared pure SHA-256 helper (byte-sensitive: CRLF, BOM, key order, trailing
 * newlines, and Unicode all affect the artifact digests).
 *
 * Position of manifest vs snapshot is fixed; swapping artifacts changes the
 * outer digest.
 */
export function computePackageArtifactChecksum(manifestText: string, snapshotText: string): string {
  const manifestDigest = sha256Hex(manifestText);
  const snapshotDigest = sha256Hex(snapshotText);
  const payload =
    PACKAGE_ARTIFACT_DOMAIN +
    "manifest:" +
    manifestDigest +
    "\n" +
    "snapshot:" +
    snapshotDigest +
    "\n";
  return sha256Hex(payload);
}
