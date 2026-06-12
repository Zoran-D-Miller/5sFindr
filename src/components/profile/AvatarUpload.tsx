"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui/Avatar";

// Direct authenticated upload to the `avatars` bucket. Files live under the
// user's <uid>/ folder (enforced by the storage RLS policy). On success it
// hands the public URL back so the editor persists it on save.
export function AvatarUpload({
  userId,
  name,
  currentUrl,
  foundingNumber,
  onUploaded,
}: {
  userId: string;
  name: string;
  currentUrl: string | null;
  foundingNumber: number | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(currentUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) return setError("Image must be under 5MB.");
    setError("");
    setBusy(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setUrl(data.publicUrl);
    onUploaded(data.publicUrl);
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} url={url} size={72} foundingNumber={foundingNumber} />
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded-xl border border-ink-600 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-pitch disabled:opacity-60"
        >
          {busy ? "Uploading…" : url ? "Change photo" : "Add photo"}
        </button>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
    </div>
  );
}
