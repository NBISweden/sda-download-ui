import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/lib/serverToken", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/app/actions/datasets", () => ({
  fetchDatasets: vi.fn(),
  fetchDatasetMetadata: vi.fn(),
  fetchDatasetFiles: vi.fn(),
  fetchAll: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/datasets/ds1",
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import DatasetDetailsView from "./page";
import { getSession } from "@/app/lib/serverToken";
import * as datasetActions from "@/app/actions/datasets";

describe("/datasets/[datasetId] (protected route)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches no protected data and renders the sign-in prompt when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const html = renderToStaticMarkup(
      await DatasetDetailsView({
        params: Promise.resolve({ datasetId: "ds1" }),
      }),
    );

    expect(getSession).toHaveBeenCalledOnce();
    expect(datasetActions.fetchAll).not.toHaveBeenCalled();
    expect(datasetActions.fetchDatasetMetadata).not.toHaveBeenCalled();
    expect(datasetActions.fetchDatasetFiles).not.toHaveBeenCalled();

    expect(html).toContain("Your session has expired or you are not signed in");
    expect(html).not.toContain("Filter files");
    expect(html).not.toContain("File selection");
  });
});
