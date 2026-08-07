query "me/contact-profile" verb=PATCH {
  api_group = "sitecraft-auto-market"
  auth = "automarket_users"

  input {
    text first_name? filters=trim
    text last_name? filters=trim
    text display_name? filters=trim
    text contact_phone? filters=trim
    email contact_email? filters=trim|lower
    bool show_phone?
    bool show_email?
    enum preferred_contact_method? {
      values = ["phone", "email"]
    }
  }

  stack {
    precondition ($auth.id != null) {
      error_type = "accessdenied"
      error = "UNAUTHORIZED"
    }

    db.get automarket_users {
      field_name = "id"
      field_value = $auth.id
    } as $current

    precondition ($current != null) {
      error_type = "notfound"
      error = "USER_NOT_FOUND"
    }

    precondition (($input.first_name == null) || (($input.first_name|strlen) <= 80)) {
      error_type = "inputerror"
      error = "FIRST_NAME_TOO_LONG"
    }

    precondition (($input.last_name == null) || (($input.last_name|strlen) <= 80)) {
      error_type = "inputerror"
      error = "LAST_NAME_TOO_LONG"
    }

    precondition (($input.display_name == null) || (($input.display_name|strlen) <= 120)) {
      error_type = "inputerror"
      error = "DISPLAY_NAME_TOO_LONG"
    }

    precondition (($input.contact_phone == null) || (($input.contact_phone|strlen) <= 32)) {
      error_type = "inputerror"
      error = "PHONE_TOO_LONG"
    }

    precondition (($input.contact_email == null) || (($input.contact_email|strlen) <= 254)) {
      error_type = "inputerror"
      error = "EMAIL_TOO_LONG"
    }

    var $next_first_name {
      value = $input.first_name
        |first_notnull:$current.first_name
    }

    var $next_last_name {
      value = $input.last_name|first_notnull:$current.last_name
    }

    var $next_display_name {
      value = $input.display_name
        |first_notnull:$current.display_name
    }

    var $next_phone {
      value = $input.contact_phone
        |first_notnull:$current.contact_phone
    }

    conditional {
      if ($input.contact_phone != null) {
        var.update $next_phone {
          value = $input.contact_phone
            |trim
            |replace:" ":""
            |replace:"(":""
            |replace:")":""
            |replace:"-":""
            |replace:"/":""
            |replace:".":""
        }

        conditional {
          if (($next_phone|substr:0:2) == "00") {
            var.update $next_phone {
              value = "+"|concat:($next_phone|substr:2:30)
            }
          }
        }

        conditional {
          if (($next_phone|substr:0:1) == "0") {
            var.update $next_phone {
              value = "+49"|concat:($next_phone|substr:1:30)
            }
          }
        }

        conditional {
          if (($next_phone|substr:0:4) == "+490") {
            var.update $next_phone {
              value = "+49"|concat:($next_phone|substr:4:30)
            }
          }
        }
      }
    }

    var $next_email {
      value = $input.contact_email
        |first_notnull:$current.contact_email
    }

    var $next_method {
      value = $input.preferred_contact_method
        |first_notnull:$current.preferred_contact_method
    }

    conditional {
      if (($next_first_name|first_notnull:""|trim) == "") {
        var.update $next_first_name {
          value = null
        }
      }
    }

    conditional {
      if (($next_last_name|first_notnull:""|trim) == "") {
        var.update $next_last_name {
          value = null
        }
      }
    }

    conditional {
      if (($next_display_name|first_notnull:""|trim) == "") {
        var.update $next_display_name {
          value = null
        }
      }
    }

    conditional {
      if (($next_phone|first_notnull:""|trim) == "") {
        var.update $next_phone {
          value = null
        }
      }
    }

    conditional {
      if (($next_email|first_notnull:""|trim) == "") {
        var.update $next_email {
          value = null
        }
      }
    }

    conditional {
      if (($next_method|first_notnull:""|trim) == "") {
        var.update $next_method {
          value = null
        }
      }
    }

    var $next_show_phone {
      value = $input.show_phone
        |first_notnull:$current.show_phone
        |first_notnull:false
    }

    var $next_show_email {
      value = $input.show_email
        |first_notnull:$current.show_email
        |first_notnull:false
    }

    precondition (($next_phone == null) || ($next_phone|regex_matches:"^\\+[1-9][0-9]{7,14}$")) {
      error_type = "inputerror"
      error = "INVALID_PHONE"
    }

    precondition (($next_show_phone != true) || ($next_phone != null)) {
      error_type = "inputerror"
      error = "PHONE_REQUIRED"
    }

    precondition (($next_show_email != true) || ($next_email != null)) {
      error_type = "inputerror"
      error = "EMAIL_REQUIRED"
    }

    precondition (($next_method != "phone") || (($next_show_phone) && ($next_phone != null))) {
      error_type = "inputerror"
      error = "PREFERRED_PHONE_NOT_PUBLIC"
    }

    precondition (($next_method != "email") || (($next_show_email) && ($next_email != null))) {
      error_type = "inputerror"
      error = "PREFERRED_EMAIL_NOT_PUBLIC"
    }

    db.edit automarket_users {
      field_name = "id"
      field_value = $auth.id
      data = {
        first_name              : $next_first_name
        last_name               : $next_last_name
        display_name            : $next_display_name
        contact_phone           : $next_phone
        contact_email           : $next_email
        show_phone              : $next_show_phone
        show_email              : $next_show_email
        preferred_contact_method: $next_method
      }
    } as $user
  }

  response = {
    first_name              : $user.first_name
    last_name               : $user.last_name
    display_name            : $user.display_name
    contact_phone           : $user.contact_phone
    contact_email           : $user.contact_email
    show_phone              : ($user.show_phone == true)
    show_email              : ($user.show_email == true)
    preferred_contact_method: $user.preferred_contact_method
  }

  tags = ["contacts", "owner-only", "whitelist"]
  guid = "hVtI2MMwQcAxy6tQq26VlrxCosk"
}
