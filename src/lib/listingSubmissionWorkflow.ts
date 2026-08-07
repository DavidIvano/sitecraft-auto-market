export type ListingSubmissionPhase =
  | "idle"
  | "validating"
  | "saving_contacts"
  | "uploading_images"
  | "creating_listing"
  | "submitting_moderation"
  | "success"
  | "error";

export type ListingSubmissionSteps<TContacts, TImages, TListing, TResult> = {
  validate: () => void | Promise<void>;
  ensureContacts: () => TContacts | Promise<TContacts>;
  ensureImages: () => TImages | Promise<TImages>;
  ensureListing: (contacts: TContacts, images: TImages) => TListing | Promise<TListing>;
  submitModeration: (listing: TListing) => TResult | Promise<TResult>;
  onPhase?: (phase: ListingSubmissionPhase) => void;
};

export async function runListingSubmissionWorkflow<TContacts, TImages, TListing, TResult>(
  steps: ListingSubmissionSteps<TContacts, TImages, TListing, TResult>,
) {
  try {
    steps.onPhase?.("validating");
    await steps.validate();
    steps.onPhase?.("saving_contacts");
    const contacts = await steps.ensureContacts();
    steps.onPhase?.("uploading_images");
    const images = await steps.ensureImages();
    steps.onPhase?.("creating_listing");
    const listing = await steps.ensureListing(contacts, images);
    steps.onPhase?.("submitting_moderation");
    const result = await steps.submitModeration(listing);
    steps.onPhase?.("success");
    return result;
  } catch (error) {
    steps.onPhase?.("error");
    throw error;
  }
}

export function getListingFilesFingerprint(files: Array<Pick<File, "name" | "size" | "lastModified">>) {
  return files
    .map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    .sort()
    .join("|");
}

export function createListingSubmitIdempotencyKey(userId: string | number, localDraftId: string) {
  const safeUserId = String(userId || "anonymous").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "anonymous";
  const safeDraftId = String(localDraftId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeDraftId) throw new Error("LOCAL_DRAFT_ID_REQUIRED");
  return `listing-submit:${safeUserId}:${safeDraftId}`;
}
