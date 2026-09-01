import { getSession } from "./lib/session";
import { PageWrapper } from "./components/PageWrapper";
import { LsaaiSignInButton } from "@/app/components/LsaaiSignInButton";

export default async function Home() {
  const sessionData = await getSession();

  return (
    <PageWrapper>
      {!sessionData ? (
        <>
          <h1>Welcome!</h1>
          <p className="mt-4">Sign in with</p>
          <LsaaiSignInButton />
        </>
      ) : (
        <>
          <h1>You are signed in!</h1>
          <p className="mt-4">
            Follow the links in the menu to start exploring.
          </p>
        </>
      )}
    </PageWrapper>
  );
}
