# SiteCraft Auto Market Xano MCP Tools

These tools are for **Agents & MCP -> Tools** in Xano.

They give Codex controlled access to inspect and repair Auto Market data:

- `Automarket_UpdateListingCoreFields`
- `Automarket_ListListingImagesDebug`
- `Automarket_AddListingImageUrl`
- `Automarket_SoftDeleteListingImage`
- `Automarket_SetListingMainImage`
- `Automarket_RecalculateListingImages`

Important: these tools do not magically create Xano API endpoints or database tables. Xano only lets Codex do what you expose as MCP tools. Use the endpoint/table scripts in `sitecraft-auto-market/docs/` for actual API/table changes, then use these MCP tools for debugging and safe data repair.
