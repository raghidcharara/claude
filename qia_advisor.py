#!/usr/bin/env python3
"""QIA Investment Advisor - a preliminary company-screening chatbot.

Loads system_prompt.md as the system prompt, gives Claude a web-search
tool so it can ground its screening in current public information, and
runs a simple multi-turn terminal chat loop.
"""

import sys
from pathlib import Path

import anthropic

MODEL = "claude-opus-5"
MAX_TOKENS = 64000
SYSTEM_PROMPT_PATH = Path(__file__).parent / "system_prompt.md"

WEB_SEARCH_TOOL = {
    "type": "web_search_20260209",
    "name": "web_search",
    "max_uses": 8,
}

GREETING = (
    "QIA Investment Advisor — a research-assistant chatbot that runs a structured, "
    "preliminary screening of a named international company, in the style of a "
    "sovereign-wealth-fund analyst's first-pass due diligence. I am not an official "
    "spokesperson or system for the Qatar Investment Authority, I have no access to "
    "QIA's actual portfolio or strategy, and nothing here is investment, legal, or tax "
    "advice.\n\nName a company to screen."
)


def load_system_prompt() -> str:
    if not SYSTEM_PROMPT_PATH.exists():
        sys.exit(f"Missing system prompt file: {SYSTEM_PROMPT_PATH}")
    return SYSTEM_PROMPT_PATH.read_text()


def stream_turn(client: anthropic.Anthropic, system: str, messages: list) -> list:
    """Send one turn, stream the visible text to stdout, return the response content blocks."""
    searching_announced = False

    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        tools=[WEB_SEARCH_TOOL],
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        messages=messages,
    ) as stream:
        for event in stream:
            if event.type == "content_block_start":
                if event.content_block.type == "server_tool_use" and not searching_announced:
                    print("\n[searching the web...]\n", flush=True)
                    searching_announced = True
            elif event.type == "content_block_delta":
                if event.delta.type == "text_delta":
                    print(event.delta.text, end="", flush=True)

        final_message = stream.get_final_message()

    print()

    if final_message.stop_reason == "refusal":
        details = final_message.stop_details
        category = getattr(details, "category", None) if details else None
        print(f"[response declined — category: {category}]")

    return final_message.content


def main() -> None:
    try:
        client = anthropic.Anthropic()
    except anthropic.AnthropicError as exc:
        sys.exit(f"Could not initialize Anthropic client: {exc}")

    system = load_system_prompt()
    messages: list = []

    print(GREETING)
    print("(type 'exit' or 'quit' to leave)\n")

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not user_input:
            continue
        if user_input.lower() in {"exit", "quit"}:
            break

        messages.append({"role": "user", "content": user_input})

        print("\nQIA Investment Advisor:")
        try:
            content = stream_turn(client, system, messages)
        except anthropic.APIStatusError as exc:
            print(f"\n[API error {exc.status_code}: {exc.message}]")
            messages.pop()
            continue
        except anthropic.APIConnectionError:
            print("\n[network error — check your connection and try again]")
            messages.pop()
            continue

        messages.append({"role": "assistant", "content": content})


if __name__ == "__main__":
    main()
