import { DealFinderApiError, type DealFinderWorkspacePayload } from "./types.ts";
import {
  normalizeWorkspaceRecord,
  readWorkspaceRecord,
  writeWorkspaceRecord,
  type DealFinderWorkspaceRecord,
} from "./workspace.ts";

export function isUnavailableWorkspaceEndpoint(error: unknown) {
  return error instanceof DealFinderApiError && (error.status === 404 || error.status === 501);
}

export async function loadWorkspaceRecordFromServerOrLocal(
  listingId: number,
  loadServer: () => Promise<unknown>,
  storage: Pick<Storage, "getItem"> | null,
): Promise<DealFinderWorkspaceRecord> {
  try {
    const payload = await loadServer();
    return normalizeWorkspaceRecord({ ...(payload as Record<string, unknown>), storage: "server" }, listingId);
  } catch (error) {
    if (!isUnavailableWorkspaceEndpoint(error)) throw error;
    return readWorkspaceRecord(storage, listingId);
  }
}

export async function saveWorkspaceRecordToServerOrLocal(
  listingId: number,
  input: DealFinderWorkspacePayload,
  saveServer: () => Promise<unknown>,
  storage: Pick<Storage, "setItem"> | null,
): Promise<DealFinderWorkspaceRecord> {
  try {
    const payload = await saveServer();
    return normalizeWorkspaceRecord({ ...(payload as Record<string, unknown>), storage: "server" }, listingId);
  } catch (error) {
    if (!isUnavailableWorkspaceEndpoint(error)) throw error;
    return writeWorkspaceRecord(storage, normalizeWorkspaceRecord({ ...input, storage: "local" }, listingId));
  }
}
