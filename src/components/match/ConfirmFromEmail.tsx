"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { confirmSpotByToken, type TokenConfirm } from "@/server/actions/participation";

// /m/<slug>?c=<token> from the "Still coming?" email. Confirms on load (in
// the browser, so link scanners that only fetch the page don't), then drops
// the token from the address bar.
export function ConfirmFromEmail({ token }: { token: string }) {
  const router = useRouter();
  const path = usePathname();
  const ran = useRef(false);
  const [result, setResult] = useState<TokenConfirm | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    confirmSpotByToken(token).then((r) => {
      setResult(r);
      router.replace(path);
      router.refresh();
    });
  }, [token, path, router]);

  if (!result) {
    return <p className="rounded-2xl border border-ink-700 p-3 text-center text-sm text-white/60">Confirming your spot…</p>;
  }
  if (result === "confirmed") {
    return (
      <p className="rounded-2xl border border-pitch/40 bg-pitch/10 p-3 text-center text-sm font-bold text-pitch">
        ✓ You’re confirmed. See you there.
      </p>
    );
  }
  return (
    <p className="rounded-2xl border border-yellow-400/40 bg-yellow-400/10 p-3 text-center text-sm text-white/80">
      {result === "released"
        ? "Your spot was freed because it wasn’t confirmed in time. Tap “I’m in” if there’s still room."
        : "This link has expired. Check the game below."}
    </p>
  );
}
