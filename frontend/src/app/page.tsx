export default function Home() {
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
        </div>
      </main>
    </div>
  );
}
