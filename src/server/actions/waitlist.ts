"use server";

import { createClient } from "@/lib/supabase/server";
import { toE164 } from "@/lib/phone";
import {
  AVAILABILITY,
  CONSENT_VERSION,
  NEIGHBOURHOODS,
  ROLES,
  type WaitlistState,
} from "@/lib/waitlist";

// The WhatsApp group is only revealed after someone joins, so it isn't
// scraped straight out of the page source.
const COMMUNITY_URL = "https://chat.whatsapp.com/BGUOFLNzLcGDauQtAiJo1I";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function joinWaitlist(
  _prev: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  // Honeypot: real people never see or fill this field.
  if (String(formData.get("company") ?? "")) return { error: "Something went wrong. Try again." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const whatsapp = toE164(String(formData.get("whatsapp") ?? ""));
  const neighbourhood = String(formData.get("neighbourhood") ?? "");
  const role = String(formData.get("role") ?? "");
  const availability = formData
    .getAll("availability")
    .map(String)
    .filter((v) => AVAILABILITY.some((a) => a.value === v));

  if (!name || name.length > 80) return { error: "What should we call you?" };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (!whatsapp) {
    return { error: "Enter a valid WhatsApp number, e.g. 082 123 4567 (or +44… if you’re visiting)." };
  }
  if (!(NEIGHBOURHOODS as readonly string[]).includes(neighbourhood)) {
    return { error: "Pick the area you’d usually play in." };
  }
  if (!ROLES.some((r) => r.value === role)) return { error: "Tell us if you play, run a game, or are a venue." };
  if (formData.get("consent_profile") !== "on") {
    return { error: "Please tick the first box so we can save your details." };
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .rpc("join_waitlist", {
        p_name: name,
        p_email: email,
        p_whatsapp: whatsapp,
        p_neighbourhood: neighbourhood,
        p_role: role,
        p_availability: availability,
        p_consent_profile: true,
        p_consent_email: formData.get("consent_email") === "on",
        p_consent_whatsapp: formData.get("consent_whatsapp") === "on",
        p_consent_version: CONSENT_VERSION,
        p_ref: String(formData.get("ref") ?? "").slice(0, 12) || null,
        p_source: String(formData.get("source") ?? "").slice(0, 120) || null,
      })
      .single<{ referral_code: string; list_position: number; referrals: number }>();
    if (error || !data) throw new Error(error?.message ?? "no data");

    return {
      joined: {
        code: data.referral_code,
        position: Number(data.list_position),
        referrals: Number(data.referrals),
        communityUrl: COMMUNITY_URL,
      },
    };
  } catch (e) {
    console.error("[5sFindr] join_waitlist failed:", e instanceof Error ? e.message : e);
    return { error: "We couldn’t save that just now. Please try again in a minute." };
  }
}
