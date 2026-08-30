"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppContentLoader } from "@/components/app-content-loader";

type SharedMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export default function PublicSharePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [title, setTitle] = useState("Shared conversation");
  const [messages, setMessages] = useState<SharedMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    void fetch(`/api/v1/share/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Share not found.");
        return res.json();
      })
      .then((body) => {
        setTitle(body.data?.share?.title ?? "Shared conversation");
        setMessages(body.data?.messages ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load share.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f5]">
        <AppContentLoader label="Loading shared conversation" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#faf9f5] px-4">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#faf9f5]">
      <header className="border-b border-black/5 bg-white/80 px-6 py-4">
        <h1 className="font-serif text-xl text-[#141413]">{title}</h1>
        <p className="mt-1 text-xs text-zinc-500">Read-only shared conversation</p>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        {messages.map((message) => (
          <article
            key={message.id}
            className="rounded-xl border border-black/5 bg-white p-4 shadow-sm"
          >
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              {message.role}
            </p>
            <div className="whitespace-pre-wrap text-sm text-zinc-800">
              {message.content}
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
