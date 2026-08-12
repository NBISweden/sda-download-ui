import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../../lib/config";
import { getSDADToken } from "../utils";

type DatasetMetadata = {
  datasetId: string;
  date: string;
  files: number;
  size: number;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ datasetid: string }> },
) {
  const token = await getSDADToken(request)

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const {datasetid} = await params
  return fetchDatasetMetadata(token?.accessToken, datasetid);
}

async function fetchDatasetMetadata(
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
