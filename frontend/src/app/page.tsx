import mockAuth from "./actions/auth";
import { getSession, getClaims } from "./lib/session";

export default async function Home() {
  const sessionData = await getSession();
  const tokenInfo = sessionData?.token
    ? await getClaims(sessionData.token)
    : undefined;
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

          <form action={mockAuth}>
            <button className="btn btn-primary" type="submit">
              Sign in
            </button>
          </form>
          <hr />
          {tokenInfo ? (
            <ul>
              {Object.keys(tokenInfo).map((key) => (
                <li key={key}>
                  <em>{key}:</em> {String(tokenInfo[key])}
                </li>
              ))}
            </ul>
          ) : (
            <></>
          )}
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
