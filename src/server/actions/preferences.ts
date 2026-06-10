"use server";

import { cookies } from "next/headers";
import type { ViewMode } from "@/lib/types";

// Remember whether the user last used Player or Organizer mode so the feed
// opens where they left off. Fire-and-forget from the client toggle.
export async function setViewPreference(view: ViewMode): Promise<void> {
  cookies().set("view", view, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
