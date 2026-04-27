"use server";

import { getConfig } from "../lib/config";

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

export async function fetchDatasets(
  token: string,
): Promise<DatasetListResponse> {
  const { sdaBaseUrl } = await getConfig();
  const response = await fetch(`${sdaBaseUrl}/datasets`, {
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
  const { sdaBaseUrl } = await getConfig();
  const response = await fetch(`${sdaBaseUrl}/datasets/${datasetId}`, {
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
