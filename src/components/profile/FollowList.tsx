"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";

interface Row {
  id: string;
  name: string;
  avatar_url: string | null;
  neighborhood: string | null;
  founding_number: number | null;
}

// Slide-up list of a user's followers or following. Two-step fetch (ids, then
// profiles) to avoid PostgREST relationship ambiguity (follows has two FKs to
// profiles). Selecting a row hands the id up so the parent can open their peek.
export function FollowList({
  userId,
  mode,
  onClose,
  onSelect,
}: {
  userId: string;
  mode: "followers" | "following";
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [shown, setShown] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    setShown(true);
    const supabase = createClient();
    const relCol = mode === "followers" ? "follower_id" : "following_id";
    const filterCol = mode === "followers" ? "following_id" : "follower_id";
    (async () => {
      const { data: rels } = await supabase.from("follows").select(relCol).eq(filterCol, userId).limit(200);
      const ids = (rels ?? []).map((r) => (r as Record<string, string>)[relCol]).filter(Boolean);
      if (!ids.length) {
        setRows([]);
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, name, avatar_url, neighborhood, founding_number")
        .in("id", ids)
        .returns<Row[]>();
      setRows(profs ?? []);
    })();
  }, [userId, mode]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-ink-600 bg-ink-800 p-6 transition-transform duration-300 ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink-600" />
        <h3 className="mb-3 text-lg font-black capitalize">{mode}</h3>
        {rows === null ? (
          <p className="py-6 text-center text-sm text-white/40">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">No {mode} yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-3 text-left transition hover:border-pitch/40"
                >
                  <Avatar name={r.name} url={r.avatar_url} size={40} foundingNumber={r.founding_number} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block text-xs text-white/40">{r.neighborhood ?? "Cape Town"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-white/30">View →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
