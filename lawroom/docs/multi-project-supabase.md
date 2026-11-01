# Lawroom connection isolation

Verified using the existing connections, without changing credentials or global CLI login.

The authorized Lawroom target is `lawportal`, project ref `deezwydtiibbdtimxcxf`, in the `lawyer` organization.

When multiple Supabase accounts are connected, explicitly select the account authorized for this project. Do not use the last-used account implicitly. Connector selection IDs are session configuration and are deliberately not published in this repository.

The LawRoom browser client validates the exact hosted project URL as well as the public-key type before `createClient`. An old public JWT must also name LawRoom and the `anon` role. A modern public key's authenticity is still checked by Supabase; this local guard prevents configuration mistakes, not server authorization. Service-role and secret keys never belong in the browser.

The separate reference application is a product/code benchmark only. Its database, environment, credentials, domain and notifications are not part of Lawroom. This task did not change that application's runtime or credentials.

CLI state is a separate boundary from MCP account selection. No global login/profile/token was changed by this task. The source task's separate profile attempt failed; a successful MCP read does not prove CLI linkage or a schema baseline. Verify the intended repository and explicit project ref before any later link/pull/push, and preserve the empty remote migration-history finding until reconciled. Foundation SQL must not be replayed against the existing remote database.

No live migration, bucket/security, SMTP, Edge Function, credential or publication change was performed by this task. Resend awaits the user's new LawRoom domain; DietRoom mail/domain/keys must not be reused.
