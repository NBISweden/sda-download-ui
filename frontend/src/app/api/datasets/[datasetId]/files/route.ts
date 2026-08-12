import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../../../lib/config";
import { getSDADToken } from "../../utils";

type NextPageToken = {
  nextPageToken: string | null;
};

type Checksum = {
  type: string;
  checksum: string;
};

type DatasetFile = {
  fileId: string;
  filePath: string;
  size: number;
  decryptedSize: number;
  checksums: Checksum[];
  downloadUrl: string;
};

type DatasetFilesResponse = {
  files: DatasetFile[];
} & NextPageToken;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetid: string }> },
) {
  const token = await getSDADToken(request)

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const {datasetid} = await params
  return fetchDatasetFiles(token?.accessToken, datasetid);
}

async function fetchDatasetFiles(
  token: string,
  datasetId: string,
  pageToken?: string,
): Promise<DatasetFilesResponse> {
  const { sdaBaseUrl } = await getConfig();
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${sdaBaseUrl}/datasets/${datasetId}/files`;
  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset files: ${response.status}`);
  }

  return response.json();
}
