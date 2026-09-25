import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  redirect(auth.session ? "/dashboard" : "/workspaces/new");
}
