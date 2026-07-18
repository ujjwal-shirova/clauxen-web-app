# Auth reference

## Worker endpoints

POST `/v1/otp/send|verify|consume-ticket`, `/v1/magic/*`, GET `/health`.  
Auth: Bearer `AUTH_EMAIL_INTERNAL_TOKEN` or `x-clauxen-internal`.  
FROM: `no-reply@clauxen.com`.

## Profile mapping

| UI | Storage |
|----|---------|
| Full name | `profiles.display_name` |
| Nickname | `profiles.preferred_name` |
| Occupation / custom instructions | `user_settings.settings.personalization` |
