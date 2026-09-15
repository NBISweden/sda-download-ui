import Link from "next/link";
import { redirect, RedirectType } from "next/navigation";
import { signOutOfIdp } from "@/app/actions/logout";
import { getEndSessionEndpoint } from "@/app/lib/oidc";
import { isSignedOut } from "@/app/lib/logoutFlow";
import { PageWrapper } from "@/app/components/PageWrapper";

// Not indexable and only reachable via logout().
export const metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default async function LoggedOutPage() {
  if (!(await isSignedOut())) {
    redirect("/", RedirectType.replace);
  }

  // Only show the "sign out of LS Login" button when the IdP actually
  // advertises an end-session endpoint. Otherwise it wouldn't do anything
  // useful.
  const endSessionEndpoint = await getEndSessionEndpoint();
  const canSignOutOfIdp = endSessionEndpoint !== null;

  return (
    <PageWrapper>
      <h1>You&rsquo;ve been signed out</h1>

      <p className="mt-4">Your session has ended.</p>

      {canSignOutOfIdp && (
        <>
          <p className="mt-4">
            You may still be signed in to <strong>LS Login</strong> and your
            institution. On shared computers we recommend signing out of those
            too so nobody else can access your account.
          </p>

          <div className="mt-3 d-flex gap-2 flex-wrap">
            <form action={signOutOfIdp}>
              <button type="submit" className="btn btn-primary">
                Sign out of LS Login
              </button>
            </form>

            <Link href="/" className="btn btn-outline-secondary">
              Return to home page
            </Link>
          </div>

          <p className="mt-3 text-muted small">
            Signing out of LS Login may redirect you to your institution&rsquo;s
            logout page. That&rsquo;s normal &mdash; it confirms you&rsquo;re
            fully signed out of the federation.
          </p>
        </>
      )}

      {!canSignOutOfIdp && (
        <Link href="/" className="btn btn-primary mt-3">
          Return to home page
        </Link>
      )}
    </PageWrapper>
  );
}
