// Worker-only endpoint. The deployment helper replaces the placeholder in
// memory; the repository never stores the secret.
query "deal-finder/internal/searches/active" verb=GET {
  api_group = "sitecraft-auto-market"

  input {}

  stack {
    var $provided_secret {
      value = $env.$http_headers."X-Deal-Finder-Secret"|first_notnull:""|to_text
    }

    precondition (($provided_secret != "") && ($provided_secret == "__DEAL_FINDER_SECRET_RAW__")) {
      error_type = "accessdenied"
      error = "Unauthorized"
    }

    db.query deal_finder_searches {
      where = (($db.deal_finder_searches.is_active == true) && ($db.deal_finder_searches.source_type == "kleinanzeigen_agent"))
      sort = {deal_finder_searches.updated_at: "desc"}
      return = {type: "list"}
    } as $searches
  }

  response = {data: $searches}
  tags = ["deal-finder", "internal", "worker", "searches"]
}
