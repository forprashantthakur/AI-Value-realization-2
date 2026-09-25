import Link from "next/link";
import { getIdentityStore } from "@/lib/identity";
import { hashToken } from "@/lib/identity/password";
import { getAuth } from "@/lib/auth/session";
import { AcceptInviteForm } from "@/components/auth/auth-forms";

export const metadata = { title: "Accept invitation" };
export const dynamic = "force-dynamic";

function Invalid({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm">
      <h1 className="text-lg font-semibold">Invitation unavailable</h1>
      <p className="text-muted-foreground">{text}</p>
      <Link href="/login" className="text-primary hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const store = await getIdentityStore();
  const inv = await store.findInvitationByTokenHash(hashToken(token));
  if (!inv || inv.acceptedAt) return <Invalid text="This link is invalid or has already been used." />;
  if (new Date(inv.expiresAt).getTime() < Date.now()) return <Invalid text="This invitation has expired. Ask the administrator to send a new one." />;
  const [ws, role, auth, existing] = await Promise.all([store.getWorkspace(inv.tenantId), store.getRole(inv.tenantId, inv.roleKey), getAuth(), store.findAccountByEmail(inv.email)]);
  if (!ws) return <Invalid text="The workspace no longer exists." />;
  if (auth && auth.account.email !== inv.email)
    return <Invalid text={`You are signed in as ${auth.account.email}, but this invitation is for ${inv.email}. Sign out first, then open the link again.`} />;
  const mode = auth ? "join" : existing ? "password" : "create";
  return <AcceptInviteForm token={token} email={inv.email} workspace={ws.name} role={role?.name ?? inv.roleKey} mode={mode} defaultName={inv.name} />;
}
