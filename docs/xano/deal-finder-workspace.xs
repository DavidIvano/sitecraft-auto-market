// Stage 2 workspace schema and owner-scoped endpoints.
// These records remain isolated from public car_listings and contain no seller contact value.
table deal_finder_notes {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id { table = "automarket_users" }
    int listing_id { table = "deal_finder_listings" }
    text note filters=trim|max:2000
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}, {name: "listing_id", op: "asc"}, {name: "created_at", op: "desc"}]}
  ]
  tags = ["deal-finder", "internal", "workspace"]
}

table deal_finder_contacts {
  auth = false
  schema {
    int id
    timestamp created_at?=now
    timestamp updated_at?=now
    int user_id { table = "automarket_users" }
    int listing_id { table = "deal_finder_listings" }
    text decision?=undecided filters=trim|lower|max:32
    text contact_status?=not_contacted filters=trim|lower|max:32
    text contact_channel?=none filters=trim|lower|max:32
    timestamp? next_action_at
  }
  index = [
    {type: "primary", field: [{name: "id"}]}
    {type: "unique", field: [{name: "user_id", op: "asc"}, {name: "listing_id", op: "asc"}]}
    {type: "btree", field: [{name: "user_id", op: "asc"}, {name: "next_action_at", op: "asc"}]}
  ]
  tags = ["deal-finder", "internal", "workspace"]
}

query "deal-finder/listings/{id}/workspace" verb=GET {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input { int id filters=min:1 }
  stack {
    db.get automarket_users { field_name = "id" field_value = $auth.id } as $current_user
    precondition (($current_user != null) && (($current_user.role == "admin") || ($current_user.role == "deal_finder_admin"))) {
      error_type = "accessdenied"
      error = "Deal Finder access required"
    }
    db.query deal_finder_listings {
      where = (($db.deal_finder_listings.id == $input.id) && ($db.deal_finder_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $listing
    precondition ($listing != null) { error_type = "notfound" error = "Listing not found" }
    db.query deal_finder_contacts {
      where = (($db.deal_finder_contacts.user_id == $current_user.id) && ($db.deal_finder_contacts.listing_id == $listing.id))
      return = {type: "single"}
    } as $contact
    db.query deal_finder_notes {
      where = (($db.deal_finder_notes.user_id == $current_user.id) && ($db.deal_finder_notes.listing_id == $listing.id))
      sort = {deal_finder_notes.created_at: "desc"}
      return = {type: "single"}
    } as $note
  }
  response = {
    listing_id: $listing.id
    decision: $contact.decision
    contact_status: $contact.contact_status
    contact_channel: $contact.contact_channel
    next_action_at: $contact.next_action_at
    note: $note.note
    updated_at: $contact.updated_at
  }
  tags = ["deal-finder", "frontend", "owner-only", "workspace"]
}

query "deal-finder/listings/{id}/workspace" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"
  input {
    int id filters=min:1
    text decision filters=trim|lower|max:32
    text contact_status filters=trim|lower|max:32
    text contact_channel filters=trim|lower|max:32
    timestamp? next_action_at
    text? note filters=trim|max:2000
  }
  stack {
    db.get automarket_users { field_name = "id" field_value = $auth.id } as $current_user
    precondition (($current_user != null) && (($current_user.role == "admin") || ($current_user.role == "deal_finder_admin"))) {
      error_type = "accessdenied"
      error = "Deal Finder access required"
    }
    precondition (($input.decision == "undecided") || ($input.decision == "contact") || ($input.decision == "watch") || ($input.decision == "skip")) {
      error_type = "inputerror"
      error = "Invalid decision"
    }
    precondition (($input.contact_status == "not_contacted") || ($input.contact_status == "planned") || ($input.contact_status == "contacted") || ($input.contact_status == "waiting") || ($input.contact_status == "closed")) {
      error_type = "inputerror"
      error = "Invalid contact status"
    }
    precondition (($input.contact_channel == "none") || ($input.contact_channel == "phone") || ($input.contact_channel == "email") || ($input.contact_channel == "message")) {
      error_type = "inputerror"
      error = "Invalid contact channel"
    }
    db.query deal_finder_listings {
      where = (($db.deal_finder_listings.id == $input.id) && ($db.deal_finder_listings.user_id == $current_user.id))
      return = {type: "single"}
    } as $listing
    precondition ($listing != null) { error_type = "notfound" error = "Listing not found" }
    db.query deal_finder_contacts {
      where = (($db.deal_finder_contacts.user_id == $current_user.id) && ($db.deal_finder_contacts.listing_id == $listing.id))
      return = {type: "single"}
    } as $existing_contact
    conditional {
      if ($existing_contact == null) {
        db.add deal_finder_contacts {
          data = {created_at: "now", updated_at: "now", user_id: $current_user.id, listing_id: $listing.id, decision: $input.decision, contact_status: $input.contact_status, contact_channel: $input.contact_channel, next_action_at: $input.next_action_at}
        } as $contact
      }
      else {
        db.edit deal_finder_contacts {
          field_name = "id"
          field_value = $existing_contact.id
          data = {updated_at: "now", decision: $input.decision, contact_status: $input.contact_status, contact_channel: $input.contact_channel, next_action_at: $input.next_action_at}
        } as $contact
      }
    }
    db.query deal_finder_notes {
      where = (($db.deal_finder_notes.user_id == $current_user.id) && ($db.deal_finder_notes.listing_id == $listing.id))
      sort = {deal_finder_notes.created_at: "desc"}
      return = {type: "single"}
    } as $latest_note
    conditional {
      if (($input.note != null) && ($input.note != "") && (($latest_note == null) || ($latest_note.note != $input.note))) {
        db.add deal_finder_notes {
          data = {created_at: "now", updated_at: "now", user_id: $current_user.id, listing_id: $listing.id, note: $input.note}
        } as $saved_note
      }
    }
  }
  response = {
    listing_id: $listing.id
    decision: $contact.decision
    contact_status: $contact.contact_status
    contact_channel: $contact.contact_channel
    next_action_at: $contact.next_action_at
    note: $input.note
    updated_at: $contact.updated_at
  }
  tags = ["deal-finder", "frontend", "owner-only", "workspace"]
}
