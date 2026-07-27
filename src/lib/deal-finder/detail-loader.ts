import type { DealFinderListingDetails } from "./types.ts";
import type { DealFinderWorkspaceRecord } from "./workspace.ts";

export type DealFinderDetailLoaders = {
  listing: (id: string) => Promise<DealFinderListingDetails>;
  workspace: (id: string) => Promise<DealFinderWorkspaceRecord>;
  localWorkspace: (id: string) => DealFinderWorkspaceRecord;
};

export async function loadDealFinderDetailData(id: string, loaders: DealFinderDetailLoaders) {
  const details = await loaders.listing(id);
  let workspace: DealFinderWorkspaceRecord;

  try {
    workspace = await loaders.workspace(id);
  } catch {
    workspace = loaders.localWorkspace(id);
  }

  return { details, workspace };
}
