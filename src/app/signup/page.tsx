import { AuthForm } from "@/components/auth/AuthForm";
import { PRELAUNCH } from "@/lib/flags";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { ref?: string; next?: string };
}) {
  return <AuthForm mode="signup" defaultRef={searchParams.ref} next={searchParams.next} allowNew={!PRELAUNCH} />;
}
