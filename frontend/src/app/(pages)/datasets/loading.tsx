export default function Loading() {
  const placeholderCards = Array.from({ length: 6 });

  return (
    <main aria-busy="true" aria-label="Loading datasets">
      <div className="container">
        <h2 className="my-3">Datasets</h2>
        <div className="row placeholder-glow">
          {/* Filter input placeholder */}
          <div className="input-group col-12 mb-3">
            <span className="input-group-text">Filter datasets</span>
            <span className="form-control placeholder col-6"></span>
          </div>

          {/* Dataset card placeholders */}
          {placeholderCards.map((_, index) => (
            <div className="col col-lg-4 p-2" key={index}>
              <div className="card shadow-sm">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between">
                    <h3 className="card-title h5 col-5">
                      <span className="placeholder col-12"></span>
                    </h3>
                    <span className="placeholder col-2 rounded-1"></span>
                  </div>
                  <div className="d-flex flex-wrap justify-content-between mb-3">
                    <span className="placeholder col-5"></span>
                    <span className="placeholder col-3"></span>
                  </div>
                  <div className="text-left">
                    <span
                      className="btn btn-secondary disabled placeholder col-5"
                      aria-hidden="true"
                    ></span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
