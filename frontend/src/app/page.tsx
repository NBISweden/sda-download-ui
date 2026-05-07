import mockAuth from "./actions/auth";
import { getSession } from "./lib/session";
import Link from "next/link";

export default async function Home() {
  const sessionData = await getSession();

  return (
    <div>
      <main>
        <div className="d-flex justify-content-center align-items-center flex-column mt-5">
          <h1>Welcome to SDA download UI!</h1>
          <p>The CLI you know, with a UI you’ll love.</p>
          <p>Making great tools more approachable.</p>
          <p className="fst-italic">From commands to clicks.</p>
          <a
            href="https://github.com/NBISweden/sda-download-ui"
            className="btn btn-primary btn-lg"
            rel="noopener noreferrer"
          >
            <i className="bi bi-github"></i> Go to repository
          </a>
          <hr />
          <Link className="btn btn-success m-1" href="/datasets">
            My Datasets
          </Link>
          <a className="btn btn-info m-1" href="/userinfo">
            User info
          </a>

          <form action={mockAuth}>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!!sessionData?.token}
            >
              {sessionData?.token ? "Signed in" : "Sign in"}
            </button>
          </form>
          <hr />
        </div>
        <div className="d-flex justify-content-between p-5">
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-success">Success</button>
          <button className="btn btn-info">Info</button>
          <button className="btn btn-warning">Warning</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-light">Light</button>
          <button className="btn btn-dark">Dark</button>
        </div>
      </main>
    </div>
  );
}
