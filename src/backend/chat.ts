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
          content: 'You are a helpful assistant.',
        },
        ...messages,
      ],
      extra_body: {
        include_reasoning: true,
      },
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
          let thinkingStarted = false;

          for await (const chunk of streamedCompletion) {
            const delta = chunk?.choices?.[0]?.delta ?? {};
            const reasoningDelta = delta?.reasoning_content ?? '';
            const answerDelta = delta?.content ?? '';

            if (reasoningDelta && !thinkingStarted) {
              thinkingStarted = true;
              push({ type: 'thinking_start' });
            }

            if (reasoningDelta) {
              push({ type: 'thinking_delta', delta: reasoningDelta });
            }

            if (answerDelta) {
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

export async function handleChatTitlePost(request: Request) {
  try {
    if (!process.env.NOVITA_API_KEY) {
      return NextResponse.json({ error: 'NOVITA_API_KEY is not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const messages = sanitizeMessages(body?.messages).slice(0, 2);

    if (messages.length < 2) {
      return NextResponse.json({ error: 'First user and assistant messages are required to generate a title.' }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: 'moonshotai/kimi-k2.5',
      messages: [
        {
          role: 'system',
          content:
            "Summarize the user's topic into a 3-5 word title. Return ONLY the title text, no quotes.",
        },
        ...messages,
      ],
      response_format: { type: 'text' },
      max_tokens: 24,
      temperature: 0.2,
      top_p: 1,
    } as any);

    const rawTitle = completion.choices?.[0]?.message?.content?.trim() || 'New Chat';
    const normalizedTitle = rawTitle.replace(/^["'`]+|["'`]+$/g, '').slice(0, 60) || 'New Chat';

    return NextResponse.json({ title: normalizedTitle });
  } catch (error: any) {
    console.error('Error while generating chat title:', error);
    return NextResponse.json(
      { error: error?.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
