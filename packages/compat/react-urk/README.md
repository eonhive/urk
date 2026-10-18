# @urk/react-urk

Compatibility package for the published legacy name. New consumers should use
`@urk/react`. This `0.2.0` package forwards every export to `@urk/react`, sharing
its context, hooks, provider, and cleanup ownership state.

This forwarding release must be published separately; existing `0.1.x` installs
are unchanged and do not share context with the new package automatically.
