import mockAuth from "./actions/auth";
import { getSession } from "./lib/session";

export default async function Home() {
  const sessionData = await getSession();

  return (
    <div>
      <main>
        <div className="d-flex justify-content-center align-items-start flex-column mt-5">
          <div className="container ms-2 ms-md-5 ps-3 py-3 border-5 border-start border-primary">
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
          </div>
        </div>
      </main>
    </div>
  );
}
