# QIA Investment Advisor

A terminal chatbot that runs a structured, preliminary screening of a named
international company, following the fixed analyst workflow defined in
[`system_prompt.md`](system_prompt.md). It uses Claude's web-search tool to
ground each screening step in current public information rather than the
model's training data alone.

This is a research/screening aid, not investment advice and not a statement
of QIA's actual holdings or strategy — see the system prompt for the full
scope, guardrails, and disclaimers.

## Setup

```bash
pip install -r requirements.txt
```

Provide Claude API credentials via one of:

- `ANTHROPIC_API_KEY` environment variable, or
- `ant auth login` (see the Anthropic CLI docs)

## Run

```bash
python qia_advisor.py
```

Type a company name to start a screening; type `exit` or `quit` to leave.

## How it works

- `system_prompt.md` holds the full behavioral spec (identity, scope,
  the Step 0 → Step 7 workflow, source discipline, and guardrails).
- `qia_advisor.py` loads that file as the system prompt, gives Claude a
  `web_search` tool so it can check things like existing QIA stakes, recent
  financials, litigation, and sentiment, and streams each turn to the
  terminal in a simple multi-turn chat loop.
