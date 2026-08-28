# AI Interaction Summary

**Tool:** Claude Code (Anthropic), used throughout as the primary coding assistant.
**Developer:** Yarin.
**Period:** 2026-08-26 to 2026-08-28.

This is the one-page version the brief asks for. The full, entry-by-entry record is in
`docs/AI_INTERACTION_LOG.md` (untracked, working draft); a longer narrative of the specific
decisions and bugs below lives in `docs/OVERALL-DESCRIPTION.md`. This page is about the
collaboration itself: how the AI was used, where it led and where it didn't, and what went
wrong along the way.

## How the work was actually split

The pattern held for most of the project: I set direction and made the calls that were
mine to make (stack, scope, ambition, security trade-offs, when to override a
recommendation), and the AI did the reading, the implementation, and the checking, then
surfaced anything it found rather than quietly working around it. Early on I told it I
needed every concept explained as we went so I could own the code in an interview, not
just accept a diff, and that held for the rest of the project: JWT, refresh rotation,
hashing versus encryption, CSRF, cookie scoping, all explained before being used.

For larger milestones (auth, the third-party integrations) the AI split the work into
independent slices and ran them as parallel subagents, with a separate agent writing
tests from the interface spec alone, deliberately blind to the implementation, so it
couldn't grade its own homework. Central review afterward still caught real defects the
parallel agents missed each time, which is the reason that review step stayed in the
process rather than being trusted away.

A habit worth naming: claims got checked, not assumed. Diagnoses were verified against
library source or a live database before being acted on, fixes were proven by making them
fail first (reverting to confirm a red state actually goes red), and more than once a
plausible-sounding first theory for a bug turned out to be wrong and was replaced once
better evidence showed up. Several of the entries in the full log exist specifically
because the AI caught its own earlier claim being false and said so, rather than letting
it stand.

## Where I overrode it

The AI recommended the cheaper option more than once and I didn't always take it. It
suggested a single loading placeholder as the smallest fix for a skeleton-count bug; I
chose to prefetch preferences instead for exact sizing, at the cost of an extra request.
It offered to defer a design flaw it had found; I said fix it in the same commit. When a
two-tab bug revoked my own session mid-review, it correctly refused to log back in for
me, since typing a password on my behalf wasn't its call to make, and handed that back.

## What I'm not going to pretend about

M4 through M6, seven commits, were never logged. That gap is real and it stays a gap
rather than being reconstructed from memory after the fact, because a rebuilt entry would
record what a handoff summary remembered, not what was actually weighed in the moment,
which defeats the point of keeping this log at all. Two AI-caused bugs also made it into
production code before being caught: the token-naming decision that quietly turned every
failed login into a "broken refresh token" message, and a deploy blueprint whose own
`NODE_ENV` setting broke the first real build. Both are covered in the fuller writeup, and
neither was caught by a green test suite; both needed the app actually run, which is the
main lesson I'm taking from this project about what tests do and don't prove.

## The short version

The AI did the bulk of the typing and a meaningful share of the judgment calls (it's the
one that found most of the bugs described here, including several of its own), but it
worked inside constraints I set and asked before crossing the ones that mattered:
security trade-offs, scope changes, and anything touching a real account or real data. I
reviewed everything it wrote, understand why each piece of it exists, and could defend any
line of it on request.
