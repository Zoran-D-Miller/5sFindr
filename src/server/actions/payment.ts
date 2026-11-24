"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyRpcError as friendly } from "@/lib/rpcErrors";

type Result = { ok: true } | { ok: false; error: string };

// Player: "I've paid" (or undo). No money moves through 5sFindr.
export async function claimPaid(matchId: string, paid: boolean): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.rpc("claim_paid", { p_match_id: matchId, p_paid: paid });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

// Organiser: tick who's paid.
export async function confirmPaid(matchId: string, userId: string, paid: boolean): Promise<Result> {
  const supabase = createClient();
  const { error } = await supabase.rpc("confirm_paid", { p_match_id: matchId, p_user_id: userId, p_paid: paid });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}

// Organiser: SnapScan link / EFT details shown to the people on the list.
// An empty value clears them.
export async function savePaymentInfo(matchId: string, details: string): Promise<Result> {
  const clean = details.trim().slice(0, 300);
  const supabase = createClient();
  const table = supabase.from("match_payment_info");
  const { error } = clean
    ? await table.upsert({ match_id: matchId, details: clean, updated_at: new Date().toISOString() })
    : await table.delete().eq("match_id", matchId);
  if (error) return { ok: false, error: "Couldn’t save the payment details." };
  revalidatePath(`/matches/${matchId}`);
  return { ok: true };
}
