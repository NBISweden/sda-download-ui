import { fetchDatasets, fetchDatasetMetadata, type DatasetMetadata } from "../../actions/datasets";
import { getSession } from "@/app/lib/session";

export default async function DataSetsViewPage() {
  const sessionData = await getSession();
  const token = sessionData?.token;

  let errorMessage: string | null = null;
  let datasetMetadataList: DatasetMetadata[] = [];

  if (!token) {
    return <p>No token found in session.</p>;
  } else {
    try {
      const result = await fetchDatasets(token);
      const datasetIds = result.datasets;

      datasetMetadataList = await Promise.all(
          datasetIds.map((datasetId) => fetchDatasetMetadata(token, datasetId)),
      );
    } catch (error) {
      const message =
          error instanceof Error ? error.message : "Unknown error occurred";

      errorMessage = message.includes("fetch failed")
          ? "Could not connect to backend. Is it running?"
          : `Could not load datasets: ${message}`;
    }
  }
  return (
      <main>
        <div className="container">
          <h2>Datasets</h2>
          <div className="row">
            {errorMessage ? (
                <div className="alert alert-warning" role="alert"><i
                    className="bi bi-exclamation-triangle-fill fs-4 pe-1"></i>
                  {errorMessage}</div>
            ) : datasetMetadataList.length === 0 ? (
                <div className="alert alert-info" role="alert"><i
                    className="bi bi-info-circle-fill fs-4 pe-1"></i>
                  No datasets were found.</div>
            ) : (
                <ul>
                  {datasetMetadataList.map((dataset) => (
                      <li key={dataset.datasetId}>
                        <pre>{JSON.stringify(dataset, null, 2)}</pre>
                      </li>
                  ))}
                </ul>
            )}
          </div>
        </div>
      </main>
  );
}
{/*<h2>Datasets</h2>
      <div className="row">
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
        <div className="col-4 p-2">
          <div className="card">
            <h5 className="card-header">
              67c98a64-72ea-54fd-91c7-24c80ff6d7f6
            </h5>
            <ul className="list-group list-group-flush">
              <li className="list-group-item">
                <em>2024-10-21</em>
              </li>
              <li className="list-group-item">
                {" "}
                60 <em>files</em>
              </li>
              <li className="list-group-item">
                <em>Dataset size:</em> 582639
              </li>
            </ul>
            <div className="card-body">
              <a
                className="btn btn-primary text-break"
                href="/ui-examples/sdad/datasets/entry/?entryId=67c98a64-72ea-54fd-91c7-24c80ff6d7f6"
              >
                View dataset 67c98a64-72ea-54fd-91c7-24c80ff6d7f6
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}*/}