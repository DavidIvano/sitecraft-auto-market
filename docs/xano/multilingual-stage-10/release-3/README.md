# Release 3 locale-aware public read candidates

Status: **local candidate only; not converted, compiled, published, or invoked in production**.

These two additive routes keep the legacy `/cars` endpoints unchanged until all Release 2.1 gates pass:

- `GET /public/locale/cars?locale=de`
- `GET /public/locale/cars/{slug}?locale=de`

Both candidates are fail-closed:

- only `de` is accepted;
- source German rows require a matching current `original` translation row;
- translated German rows require `translations_ready=true`, `reviewed`, and a `source_hash` equal to the listing's current `translation_source_hash`;
- unavailable, stale, pending, failed, empty-title, and empty-description rows are omitted or return 404;
- no seller contact, auth data, translation jobs, provider metadata, prompt, or internal source hash is returned;
- catalog reads use one bounded listing query and one bounded translation query; detail uses one listing lookup, one translation lookup, and one image query;
- no translation provider is called.

Before any publication, the files require Xano conversion/compile, a fresh endpoint backup, ID assignment, authenticated security review, controlled/pilot-ID preview smoke, query-history measurement, and rollback capture. Publication remains forbidden while the Release 2.1 checklist is not fully PASS.
