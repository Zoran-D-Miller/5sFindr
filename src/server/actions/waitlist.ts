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
  const roles = ROLES.map((r) => r.value).filter((v) => formData.getAll("roles").includes(v));
  const picked = formData.getAll("neighbourhoods").map(String);
  const neighbourhoods = NEIGHBOURHOODS.filter((n) => picked.includes(n));
  // One area is home by default; with several, the form asks which.
  const home =
    neighbourhoods.length === 1 ? neighbourhoods[0] : String(formData.get("home_neighbourhood") ?? "");
  const availability = formData
    .getAll("availability")
    .map(String)
    .filter((v) => AVAILABILITY.some((a) => a.value === v));

  if (!name || name.length > 80) return { error: "What should we call you?" };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (!whatsapp) return { error: "Enter a valid WhatsApp number, e.g. 082 123 4567." };
  if (roles.length === 0) return { error: "Tell us if you play, run a game, or are a venue (pick all that apply)." };
  if (neighbourhoods.length === 0) return { error: "Pick the areas you usually play in." };
  if (!(neighbourhoods as string[]).includes(home)) return { error: "Tap the area you play in most." };
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
        p_roles: roles,
        p_neighbourhoods: neighbourhoods,
        p_home_neighbourhood: home,
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
