import OpenAI from 'openai';
import { NextResponse } from 'next/server';

type ChatRole = 'user' | 'assistant' | 'system';
type IncomingMessage = { role: ChatRole; content: string };
type ChatStreamEvent =
  | { type: 'start' }
  | { type: 'thinking_start' }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'answer_delta'; delta: string }
  | { type: 'done' }
  | { type: 'error'; message: string };

const openai = new OpenAI({
  baseURL: 'https://api.novita.ai/openai',
  apiKey: process.env.NOVITA_API_KEY,
});

function encodeEvent(event: ChatStreamEvent) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function extractThinkingAndAnswer(raw: string) {
  let thinkingContent = '';
  let answerContent = '';
  let cursor = 0;
  let isInsideThink = false;

  while (cursor < raw.length) {
    if (!isInsideThink) {
      const openIndex = raw.indexOf('<think>', cursor);

      if (openIndex === -1) {
        answerContent += raw.slice(cursor);
        break;
      }

      answerContent += raw.slice(cursor, openIndex);
      cursor = openIndex + '<think>'.length;
      isInsideThink = true;
      continue;
    }

    const closeIndex = raw.indexOf('</think>', cursor);

    if (closeIndex === -1) {
      thinkingContent += raw.slice(cursor);
      break;
    }

    thinkingContent += raw.slice(cursor, closeIndex);
    cursor = closeIndex + '</think>'.length;
    isInsideThink = false;
  }

  return {
    thinkingContent,
    answerContent,
    hasThinkTag: raw.includes('<think>'),
  };
}

function sanitizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((message: unknown): message is IncomingMessage => {
      if (!message || typeof message !== 'object') {
        return false;
      }

      const candidate = message as { role?: unknown; content?: unknown };
      return (
        typeof candidate.role === 'string' &&
        typeof candidate.content === 'string' &&
        ['user', 'assistant', 'system'].includes(candidate.role)
      );
    })
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export async function handleChatPost(request: Request) {
  try {
    if (!process.env.NOVITA_API_KEY) {
      return NextResponse.json({ error: 'NOVITA_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const messages = sanitizeMessages(body?.messages);

    if (messages.length === 0) {
      return NextResponse.json({ error: 'At least one message is required.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'moonshotai/kimi-k2.5',
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Always begin your response with <think> and stream your live reasoning inside that tag. When you are ready to answer the user, close </think> and continue with the user-facing response in polished markdown outside the think tags.',
        },
        ...messages,
      ],
      response_format: { type: 'text' },
      max_tokens: 131072,
      temperature: 1,
      top_p: 1,
      min_p: 0,
      top_k: 50,
      presence_penalty: 0,
      frequency_penalty: 0,
      repetition_penalty: 1,
    } as any);

    const streamedCompletion = completion as unknown as AsyncIterable<any>;
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (event: ChatStreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

        try {
          push({ type: 'start' });

          let raw = '';
          let sentThinkingLength = 0;
          let sentAnswerLength = 0;
          let thinkingStarted = false;

          for await (const chunk of streamedCompletion) {
            const delta = chunk?.choices?.[0]?.delta?.content ?? '';
            if (!delta) continue;

            raw += delta;
            const parsed = extractThinkingAndAnswer(raw);

            if (!thinkingStarted && parsed.hasThinkTag) {
              thinkingStarted = true;
              push({ type: 'thinking_start' });
            }

            const thinkingDelta = parsed.thinkingContent.slice(sentThinkingLength);
            const answerDelta = parsed.answerContent.slice(sentAnswerLength);

            if (thinkingDelta) {
              sentThinkingLength = parsed.thinkingContent.length;
              push({ type: 'thinking_delta', delta: thinkingDelta });
            }

            if (answerDelta) {
              sentAnswerLength = parsed.answerContent.length;
              push({ type: 'answer_delta', delta: answerDelta });
            }
          }

          push({ type: 'done' });
          controller.close();
        } catch (error: any) {
          push({
            type: 'error',
            message: error?.message || 'The assistant stream failed.',
          });
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Error while calling Clauxen:', error);
    return NextResponse.json(
      { error: error?.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
