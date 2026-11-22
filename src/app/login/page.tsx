import { AuthForm } from "@/components/auth/AuthForm";
import { PRELAUNCH } from "@/lib/flags";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return <AuthForm mode="login" next={searchParams.next} allowNew={!PRELAUNCH} notice={searchParams.error} />;
}
