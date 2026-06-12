"""Python-only Novita agent runtime template.

Run this outside Next.js when you want the actual worker process to live in
Python while the web app handles UI, auth, settings, and request history.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any

from openai import OpenAI


NOVITA_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.novita.ai/openai")
DEFAULT_MODEL = os.getenv("LLM_MODEL", "minimax/minimax-m2")


def image_to_data_url(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('utf-8')}"


def get_current_time() -> str:
    from datetime import datetime, timezone

    return json.dumps({"iso": datetime.now(timezone.utc).isoformat()})


def build_tools() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_current_time",
                "description": "Return the current UTC time.",
                "parameters": {"type": "object", "properties": {}},
            },
        }
    ]


def run_agent(
    prompt: str,
    *,
    model: str = DEFAULT_MODEL,
    image: Path | None = None,
    image_url: str | None = None,
    structured: bool = False,
    thinking: bool = True,
) -> dict[str, Any]:
    client = OpenAI(
        api_key=os.environ["LLM_API_KEY"],
        base_url=NOVITA_BASE_URL,
    )

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    if image:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": image_to_data_url(image), "detail": "auto"},
            }
        )
    if image_url:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": image_url, "detail": "high"},
            }
        )

    response_format: dict[str, Any] | None = None
    if structured:
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "agent_result",
                "schema": {
                    "type": "object",
                    "properties": {
                        "summary": {"type": "string"},
                        "next_actions": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": ["summary", "next_actions"],
                },
            },
        }

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are a safe production agent. Use tools only when useful. "
                "Do not provide stealth, abuse, credential theft, or evasion guidance."
            ),
        },
        {"role": "user", "content": content},
    ]

    first = client.chat.completions.create(
        model=model,
        messages=messages,
        tools=build_tools(),
        stream=False,
        max_tokens=4096,
        temperature=0.6,
        response_format=response_format,
        extra_body={
            "enable_thinking": thinking,
            "separate_reasoning": thinking,
            "reasoning_split": thinking,
        },
    )

    message = first.choices[0].message
    if message.tool_calls:
        messages.append(message.model_dump(exclude_none=True))
        for call in message.tool_calls:
            if call.function.name == "get_current_time":
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": call.id,
                        "content": get_current_time(),
                    }
                )
        final = client.chat.completions.create(
            model=model,
            messages=messages,
            stream=False,
            max_tokens=4096,
            temperature=0.6,
            response_format=response_format,
            extra_body={
                "enable_thinking": thinking,
                "separate_reasoning": thinking,
                "reasoning_split": thinking,
            },
        )
        message = final.choices[0].message

    return message.model_dump(exclude_none=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("prompt")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--image", type=Path)
    parser.add_argument("--image-url")
    parser.add_argument("--structured", action="store_true")
    parser.add_argument("--no-thinking", action="store_true")
    args = parser.parse_args()

    result = run_agent(
        args.prompt,
        model=args.model,
        image=args.image,
        image_url=args.image_url,
        structured=args.structured,
        thinking=not args.no_thinking,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
