# @urk/next-urk

Compatibility package for the published legacy name. New consumers should use
`@urk/next`. This `0.2.0` client entrypoint forwards every export to `@urk/next`,
which composes the shared `@urk/react` provider without changing SSR or ownership.

This forwarding release must be published separately; existing `0.1.x` installs
are unchanged. Upgrade both legacy wrappers when mixing old and new import names.
