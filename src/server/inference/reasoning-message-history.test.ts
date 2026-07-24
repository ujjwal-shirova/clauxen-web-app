import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendAssistantTurn,
  appendToolResults,
} from "@/server/inference/reasoning-message-history";

describe("reasoning-message-history", () => {
  it("appendAssistantTurn preserves reasoning_content, reasoning_details, and tool_calls", () => {
    const history = appendAssistantTurn([], {
      content: "I'll check the weather.",
      reasoning_content: "First I need to call get_weather for Tokyo.",
      reasoning_details: [
        {
          type: "reasoning.text",
          format: "openai-responses-v1",
          text: "Planning tool call",
        },
      ],
      tool_calls: [
        {
          id: "call_123",
          type: "function",
          function: {
            name: "get_weather",
            arguments: '{"location":"Tokyo"}',
          },
        },
      ],
    });

    assert.equal(history.length, 1);
    const assistant = history[0] as {
      role: string;
      content: string | null;
      reasoning_content?: string;
      reasoning_details?: unknown[];
      tool_calls?: unknown[];
    };
    assert.equal(assistant.role, "assistant");
    assert.equal(assistant.content, "I'll check the weather.");
    assert.equal(
      assistant.reasoning_content,
      "First I need to call get_weather for Tokyo.",
    );
    assert.equal(assistant.reasoning_details?.length, 1);
    assert.equal(assistant.tool_calls?.length, 1);
  });

  it("appendToolResults chains tool messages after assistant turn", () => {
    const withAssistant = appendAssistantTurn([], {
      content: null,
      reasoning_content: "done planning",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "web_search", arguments: '{"query":"tokyo"}' },
        },
      ],
    });

    const full = appendToolResults(withAssistant, [
      { tool_call_id: "call_1", content: '{"results":[]}' },
    ]);

    assert.equal(full.length, 2);
    assert.equal(full[1].role, "tool");
    assert.equal(
      (full[1] as { tool_call_id?: string }).tool_call_id,
      "call_1",
    );

    const assistant = full[0] as { reasoning_content?: string };
    assert.equal(assistant.reasoning_content, "done planning");
  });

  it("matches Python SDK round-trip shape for DeepSeek tool loops", () => {
    let history = appendAssistantTurn(
      [{ role: "user", content: "Weather in Tokyo?" }],
      {
        content: "",
        reasoning_content: "Need live weather data.",
        tool_calls: [
          {
            id: "call_weather",
            type: "function",
            function: {
              name: "get_weather",
              arguments: '{"location":"Tokyo"}',
            },
          },
        ],
      },
    );

    history = appendToolResults(history, [
      {
        tool_call_id: "call_weather",
        content: '{"temp_c":22,"condition":"clear"}',
      },
    ]);

    assert.equal(history.length, 3);
    const assistant = history[1] as {
      reasoning_content?: string;
      tool_calls?: Array<{ function: { name: string } }>;
    };
    assert.ok(assistant.reasoning_content);
    assert.equal(assistant.tool_calls?.[0]?.function.name, "get_weather");
    assert.equal(history[2].role, "tool");
  });
});
