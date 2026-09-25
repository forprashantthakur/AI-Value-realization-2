import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { signupAllowed } from "@/app/actions/auth";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const auth = await getAuth();
  if (auth) redirect(auth.session ? "/dashboard" : "/workspaces/new");
  return <LoginForm allowSignup={await signupAllowed()} />;
}
