import Link from "next/link";
import { getSession } from "./lib/session";
import { PageWrapper } from "./components/PageWrapper";
import {LoginButton} from "@/app/components/LoginButton";

export default async function Home() {
  const sessionData = await getSession();

  return (
    <PageWrapper>
      {!sessionData ? (
        <>
          <h1>Welcome!</h1>
          <p className="mt-4">
            Sign in to explore datasets and download files.
          </p>
          <LoginButton/>
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
