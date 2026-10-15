import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/lib/serverToken", () => ({
  getSession: vi.fn(),
}));

// Mocking the whole datasets action module lets us assert that no upstream
// fetch happens, without depending on the network layer.
vi.mock("@/app/actions/datasets", () => ({
  fetchDatasets: vi.fn(),
  fetchDatasetMetadata: vi.fn(),
  fetchDatasetFiles: vi.fn(),
  fetchAll: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/datasets",
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import DataSetsViewPage from "./page";
import { getSession } from "@/app/lib/serverToken";
import * as datasetActions from "@/app/actions/datasets";

describe("/datasets (protected route)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches no protected data and renders the sign-in prompt when unauthenticated", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const html = renderToStaticMarkup(await DataSetsViewPage());

    expect(getSession).toHaveBeenCalledOnce();
    expect(datasetActions.fetchAll).not.toHaveBeenCalled();
    expect(datasetActions.fetchDatasets).not.toHaveBeenCalled();
    expect(datasetActions.fetchDatasetMetadata).not.toHaveBeenCalled();
    expect(datasetActions.fetchDatasetFiles).not.toHaveBeenCalled();

    expect(html).toContain("Your session has expired or you are not signed in");
    expect(html).not.toContain("Filter datasets");
  });
});
