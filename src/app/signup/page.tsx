import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage({
  searchParams,
}: {
  searchParams: { ref?: string; next?: string };
}) {
  return <AuthForm mode="signup" defaultRef={searchParams.ref} next={searchParams.next} />;
}
