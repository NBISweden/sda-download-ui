export default function Loading() {
  const placeholderRows = Array.from({ length: 8 });
  // Column widths approximate the real DatasetFiles table so the layout does
  // not jump when data arrives; `fill` keeps placeholder bars looking like
  // varied content rather than uniform full-width blocks.
  const fileColumns = [
    { header: "Select", width: "7%", fill: "col-5" },
    { header: "File ID", width: "16%", fill: "col-9" },
    { header: "Path", width: "29%", fill: "col-11" },
    { header: "Decrypted size", width: "15%", fill: "col-5" },
    { header: "Checksums", width: "21%", fill: "col-8" },
    { header: " ", width: "12%", fill: "col-7" },
  ];

  return (
    <main aria-busy="true" aria-label="Loading dataset">
      <div className="container">
        <div className="row mt-5 placeholder-glow">
          {/* Dataset details card placeholder */}
          <div className="card px-0 col-12 col-lg-6">
            <div className="card-header">
              <h3 className="card-title m-3 col-6">
                <span className="placeholder col-12"></span>
              </h3>
            </div>
            <div className="card-body mx-3 mb-2">
              <div className="d-flex">
                <div className="d-flex flex-column flex-grow-1 align-items-start mb-4 mb-sm-0">
                  <p className="fs-1 mb-1 col-4">
                    <span className="placeholder col-12"></span>
                  </p>
                  <span className="fs-5 col-3">
                    <span className="placeholder col-12"></span>
                  </span>
                </div>
                <span className="placeholder col-3 align-self-start rounded-1"></span>
              </div>
              <div className="d-flex justify-content-start mt-3">
                <span
                  className="btn btn-primary disabled placeholder col-3 me-3"
                  aria-hidden="true"
                ></span>
                <span
                  className="btn btn-primary disabled placeholder col-3"
                  aria-hidden="true"
                ></span>
              </div>
            </div>
          </div>

          {/* Files section placeholder */}
          <div className="container mt-5 px-0 placeholder-glow">
            <h3>Files</h3>

            {/* Filter input placeholder */}
            <div className="input-group col-12 my-3">
              <span className="input-group-text">Filter files</span>
              <span className="form-control placeholder col-6"></span>
            </div>

            {/* Files table placeholder */}
            <div className="table-responsive">
              <table className="table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {fileColumns.map((column, index) => (
                    <col key={index} style={{ width: column.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {fileColumns.map((column, index) => (
                      <th key={index} scope="col">
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {placeholderRows.map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {fileColumns.map((column, colIndex) => (
                        <td key={colIndex}>
                          <span className={`placeholder ${column.fill}`}></span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
