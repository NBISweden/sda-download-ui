import mockAuth from "./actions/auth";
import { getSession } from "./lib/session";
import { PageWrapper } from "./components/PageWrapper";

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
          <form action={mockAuth}>
            <button className="btn btn-primary" type="submit">
              Sign in
            </button>
          </form>
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
