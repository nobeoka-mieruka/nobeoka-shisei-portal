import ogManifestData from "../data/ogManifest.json";
import { SITE_URL } from "../config/site";

interface OgManifest {
  members: string[];
  bills: string[];
}

const ogManifest = ogManifestData as OgManifest;

/** マニフェストに存在する場合のみ、議員個別OGP画像の絶対URLを返す（なければundefined＝共通画像へフォールバック）。 */
export function memberOgImage(memberId: string): string | undefined {
  return ogManifest.members.includes(memberId) ? `${SITE_URL}/og/members/${memberId}.jpg` : undefined;
}

/** マニフェストに存在する場合のみ、議案個別OGP画像の絶対URLを返す（なければundefined＝共通画像へフォールバック）。 */
export function billOgImage(billId: string): string | undefined {
  return ogManifest.bills.includes(billId) ? `${SITE_URL}/og/bills/${billId}.jpg` : undefined;
}
