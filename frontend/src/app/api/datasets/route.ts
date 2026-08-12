import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "../../lib/config";
import { getSDADToken } from "./utils";

type NextPageToken = {
  nextPageToken: string | null;
};

type DatasetListResponse = {
  datasets: string[];
} & NextPageToken;


export async function GET(
  request: NextRequest,
) {
  const token = await getSDADToken(request)

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const nextPageToken = request?.nextUrl?.searchParams.get("nextPageToken") || undefined;
  return NextResponse.json(
    await fetchDatasets(token?.accessToken, nextPageToken)
  );
}

export async function fetchDatasets(
  token: string,
  pageToken?: string,
): Promise<DatasetListResponse> {

  const { sdaBaseUrl } = await getConfig();
  const params = new URLSearchParams();
  if (pageToken) {
    params.set("pageToken", pageToken);
  }
  const baseUrl = `${sdaBaseUrl}/datasets`;
  const response = await fetch(baseUrl + (params.size ? `?${params}` : ""), {
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