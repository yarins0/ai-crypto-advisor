# Overall Description

This is a walk through the decisions and bugs that shaped the project, pulled from
`docs/AI_INTERACTION_LOG.md` for anyone who wants the story without reading all 55 entries.
Architecture, setup and the API contract are covered elsewhere; this is the "why does it look
like this" and "what actually went wrong" version.

## 📌 Decisions worth knowing about

#### The news source changed mid-project

The plan originally called for CryptoPanic. Before committing to it, the alternatives got a
real look: CoinGecko's news endpoint turned out to be paywalled, and Cointelegraph's RSS feed
worked with a plain `curl` and no API key at all. Free and unauthenticated beat "documented as
free" every time, so the swap was made before any code depended on the old choice.

#### The refresh token almost ended up shared across two domains

The first version of the plan put the API on Render and the web app on Vercel with a cookie
shared between them, which means `SameSite=None`, which Safari and Brave block by default. A
reviewer opening the site cold would look logged out on every refresh. The fix was to route
`/api/*` through a Vercel rewrite so the API looks same-origin to the browser, which also means
the cookie can use `SameSite=Lax` and get CSRF protection for free, no token machinery required.
The alternative, storing the refresh token in `localStorage`, was considered and rejected, since
that trades a cookie-scoping problem for an XSS-exposure one.

#### Refresh tokens are hashed with a pepper, not just hashed

A plain hash of the token would mean anyone with read access to the `refreshTokens` collection
could match a captured token to its row. That specifically matters here because M7 hands a
read-only Atlas login to whoever reviews this project, so the stored value is
`HMAC-SHA256(token, pepper)`, with the pepper held only in the API's environment, never in the
database it's protecting.

#### Onboarding got shorter, and it cost something specific

Early feedback was that the questionnaire asked for preferences a user might not need: someone
who only wants prices shouldn't have to answer questions about news tone. Dropping the unused
questions outright turned out to be impossible without a data-model change: every vote stamps
an `investorType` onto itself for later analysis, so a "prices-only" user still needs a value
the moment they vote. The compromise defaults that field instead of asking for it up front.
**Cost, stated rather than hidden:** a vote's training snapshot can no longer tell a user's
actual preference apart from one that was silently defaulted for them.

## 🐛 Bugs that took real digging

#### Every failed login looked like a broken refresh token

A wrong password returns 401, and the API client treated any 401 as "access token expired, try
refreshing," which then failed too, since there was never a session to refresh, and that
failure is what actually reached the screen. The real error message never survived to be shown.
Fixed by checking, before the request goes out, whether it even carried an access token to
begin with.

#### Signing in or out didn't work until the page was reloaded

The route guards render `<Navigate>` rather than calling a navigation function, so they only
move when React Query notifies them of a change. Clearing the query cache on logout destroys
the query object outright instead of emptying it, so the object that gets rebuilt afterward has
no listeners attached: the data was correct, nothing was watching it change.

#### A stale smoke-test script was hiding a real API gap

A "known good" baseline of partial failures was assumed to be one rate limit cascading, but it
wasn't. Eight of those failures were the vote endpoint rejecting requests because the smoke
script had never been updated for a schema field added weeks earlier, meaning that endpoint had
had no real end-to-end coverage since the schema changed. The in-process test suite never
flagged it, because that one did get updated.

#### A design pass shipped that changed nothing anyone could see

Card elevation was tuned by checking computed CSS values, which all looked correct: the shadow
and highlight were both there, just calculated against colors extreme enough that neither was
visible to the eye. Caught only by looking at it in a real browser, not by any test.
