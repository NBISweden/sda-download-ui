"use server";

export type DatasetListResponse = {
  datasets: string[];
  nextPageToken: string | null;
};

export type DatasetMetadata = {
  datasetId: string;
  date: string;
  files: number;
  size: number;
};

const baseUrl =
  process.env.DATASETS_API_BASE_URL || "http://host.docker.internal:8085";

export async function fetchDatasets(
  token: string,
): Promise<DatasetListResponse> {
  const response = await fetch(`${baseUrl}/datasets`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch datasets: ${response.status}`);
  }

  return response.json();
}

export async function fetchDatasetMetadata(
  token: string,
  datasetId: string,
): Promise<DatasetMetadata> {
  const response = await fetch(`\`${baseUrl}/datasets\`/${datasetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset metadata: ${response.status}`);
  }

  return response.json();
}
