import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { signupAllowed } from "@/app/actions/auth";
import { SignupForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getAuth()) redirect("/dashboard");
  if (!(await signupAllowed()))
    return (
      <div className="space-y-2 text-sm">
        <h1 className="text-lg font-semibold">Sign-up is by invitation</h1>
        <p className="text-muted-foreground">Ask a workspace administrator to invite you.</p>
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  return <SignupForm />;
}
