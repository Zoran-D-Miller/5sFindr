import { createClient } from "@/lib/supabase/server";
import { SubscriptionCard } from "@/components/wallet/SubscriptionCard";
import { TokenWallet } from "@/components/wallet/TokenWallet";
import { TokenBundles } from "@/components/wallet/TokenBundles";
import { TokenLedger } from "@/components/wallet/TokenLedger";
import { ReferralCard } from "@/components/wallet/ReferralCard";
import { CommunityBanner } from "@/components/CommunityBanner";
import type { Subscription, Token, TokenTransaction, Profile } from "@/lib/types";

export default async function WalletPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const [{ data: subscription }, { data: tokens }, { data: txns }, { data: profile }] =
    await Promise.all([
      supabase
        .from("subscriptions")
        .select("state, free_until, current_period_end, cancel_at_period_end")
        .eq("user_id", uid)
        .single<Subscription>(),
      supabase
        .from("tokens")
        .select("id, status, committed_match_id")
        .eq("owner_id", uid)
        .order("created_at", { ascending: true })
        .returns<Token[]>(),
      supabase
        .from("token_transactions")
        .select("id, type, amount_zar, note, match_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(25)
        .returns<TokenTransaction[]>(),
      supabase.from("profiles").select("referral_code").eq("id", uid).single<Pick<Profile, "referral_code">>(),
    ]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://5sfindr.com";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black tracking-tight">Wallet</h1>

      {subscription && <SubscriptionCard subscription={subscription} />}
      <TokenWallet tokens={tokens ?? []} />
      <TokenBundles />
      {profile && <ReferralCard code={profile.referral_code} siteUrl={siteUrl} />}
      <CommunityBanner />
      <TokenLedger transactions={txns ?? []} />
    </div>
  );
}
