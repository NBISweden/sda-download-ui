import Link from "next/link";
import { redirect, RedirectType } from "next/navigation";
import { isFromLogoutCompleteFlow } from "@/app/lib/logoutFlow";
import { PageWrapper } from "@/app/components/PageWrapper";

// Not indexable and only reachable via signOutOfIdp() + IdP round-trip.
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function LogoutCompletePage() {
  if (!(await isFromLogoutCompleteFlow())) {
    redirect("/", RedirectType.replace);
  }

  return (
    <PageWrapper>
      <h1>You have been signed out of everything</h1>

      <p className="mt-4">
        Your sessions with SDA Download and <strong>LS Login</strong> have both
        ended.
      </p>

      <p className="text-muted small">
        If your institution supports it, your institutional session may also
        have ended. On shared computers, close all browser windows before
        leaving to make sure no other services stay signed in.
      </p>

      <Link href="/" className="btn btn-primary mt-3">
        Return to home page
      </Link>
    </PageWrapper>
  );
}
