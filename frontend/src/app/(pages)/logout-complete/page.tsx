import Link from "next/link";
import { PageWrapper } from "@/app/components/PageWrapper";

export default function LogoutCompletePage() {
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
