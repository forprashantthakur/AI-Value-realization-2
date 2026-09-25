import Link from "next/link";
import { getAuth, getSession } from "@/lib/auth/session";
import { roleLabel } from "@/lib/auth/rbac";
import { PageHeader, SectionCard } from "@/components/value/page-header";
import { PasswordForm, ProfileForm } from "@/components/auth/account-forms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  await getSession();
  const auth = (await getAuth())!;
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Your account" title="Account" description={`Signed in as ${auth.account.email}.`} />
      <SectionCard title="Profile">
        <ProfileForm name={auth.account.name} />
      </SectionCard>
      <SectionCard title="Password">
        <PasswordForm />
      </SectionCard>
      <SectionCard title="Your workspaces" description="Switch workspaces from the selector at the top left.">
        <ul className="space-y-1 text-sm">
          {auth.workspaces.map((w) => (
            <li key={w.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <span className="font-medium">{w.name}</span>
              <span className="text-xs text-muted-foreground">{w.id === auth.session?.tenantId ? auth.session.roleName : roleLabel(w.roleKey)}</span>
            </li>
          ))}
        </ul>
        <Link href="/workspaces/new" className="mt-3 inline-block text-xs text-primary hover:underline">
          + Create another workspace
        </Link>
      </SectionCard>
    </div>
  );
}
