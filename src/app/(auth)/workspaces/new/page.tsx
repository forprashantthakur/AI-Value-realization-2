import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth/session";
import { NewWorkspaceForm } from "@/components/auth/auth-forms";

export const metadata = { title: "New workspace" };
export const dynamic = "force-dynamic";

export default async function NewWorkspacePage() {
  const auth = await getAuth();
  if (!auth) redirect("/login");
  return <NewWorkspaceForm first={auth.workspaces.length === 0} />;
}
