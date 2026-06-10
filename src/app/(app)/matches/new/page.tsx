import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPremium } from "@/lib/entitlements";
import { MatchCreateForm } from "@/components/match/MatchCreateForm";
import type { VenueOption } from "@/lib/types";

export default async function NewMatchPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Premium gate — free/expired users are routed to upgrade.
  if (!(await isPremium(user!.id))) redirect("/wallet");

  // Seeded Cape Town venues for the dropdown (custom fields are typed in).
  const { data: venues } = await supabase
    .from("locations")
    .select("id, name, type, neighborhood")
    .eq("is_seeded", true)
    .order("name", { ascending: true })
    .returns<VenueOption[]>();

  return (
    <>
      <h1 className="mb-6 text-2xl font-black tracking-tight">Create a match</h1>
      <MatchCreateForm venues={venues ?? []} />
    </>
  );
}
