import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets, the manifest, icons and the
  // generated service worker / workbox files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js|workbox-|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
