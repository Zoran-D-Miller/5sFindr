import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return <AuthForm mode="login" next={searchParams.next} />;
}
