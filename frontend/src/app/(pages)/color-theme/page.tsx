import { notFound } from "next/navigation";

export default function ColorTheme() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <>
      <div className="container py-4">
        <h2 className="mb-4">Theme tester</h2>

        <section className="mb-5">
          <h3 className="mb-3">Regular buttons</h3>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary">
              Primary
            </button>
            <button type="button" className="btn btn-secondary">
              Secondary
            </button>
            <button type="button" className="btn btn-success">
              Success
            </button>
            <button type="button" className="btn btn-danger">
              Danger
            </button>
            <button type="button" className="btn btn-warning">
              Warning
            </button>
            <button type="button" className="btn btn-info">
              Info
            </button>
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-3">Buttons with outline</h3>
          <div className="d-flex flex-wrap gap-2">
            <button type="button" className="btn btn-outline-primary">
              Primary
            </button>
            <button type="button" className="btn btn-outline-secondary">
              Secondary
            </button>
            <button type="button" className="btn btn-outline-success">
              Success
            </button>
            <button type="button" className="btn btn-outline-danger">
              Danger
            </button>
            <button type="button" className="btn btn-outline-warning">
              Warning
            </button>
            <button type="button" className="btn btn-outline-info">
              Info
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-3">Buttons using subtle background</h3>
          <div className="d-flex flex-wrap gap-2">
            <button
              type="button"
              className="btn bg-primary-subtle text-primary-emphasis border border-primary-subtle"
            >
              Primary
            </button>
            <button
              type="button"
              className="btn bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle"
            >
              Secondary
            </button>
            <button
              type="button"
              className="btn bg-success-subtle text-success-emphasis border border-success-subtle"
            >
              Success
            </button>
            <button
              type="button"
              className="btn bg-danger-subtle text-danger-emphasis border border-danger-subtle"
            >
              Danger
            </button>
            <button
              type="button"
              className="btn bg-warning-subtle text-warning-emphasis border border-warning-subtle"
            >
              Warning
            </button>
            <button
              type="button"
              className="btn bg-info-subtle text-info-emphasis border border-info-subtle"
            >
              Info
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
