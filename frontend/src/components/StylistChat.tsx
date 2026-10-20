"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import type { ShoppingResultItem, StylistMessage } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: string[];
  searchTriggered?: boolean;
  shopQuery?: string;
  results?: ShoppingResultItem[];
  currency?: string;
};

const DEFAULT_GREETINGS = {
  stylist:
    "Hey! I'm your stylist. What's the occasion today — or just tell me about your style and we'll go from there.",
  shopping:
    "Looking for something specific, or want me to help you find the right piece?",
};

const EXAMPLE_PROMPTS = {
  stylist: '"I need an outfit for a date" or "What\'s trending right now?"',
  shopping: '"summer dress under $80" or "help me find interview clothes"',
};

export default function StylistChat({
  mode,
  onSearchResults,
  onSuggestion,
  onStylistResult,
  onSend,
  greeting,
  location,
  className = "",
}: {
  mode: "stylist" | "shopping";
  onSearchResults?: (results: ShoppingResultItem[], currency?: string, noLocal?: boolean, city?: string) => void;
  onSuggestion?: (reasoning: string) => void;
  onStylistResult?: (result: { reasoning: string; item_ids: string[]; outfit_id: string; decline: boolean }) => void;
  onSend?: () => void;
  greeting?: string;
  location?: { country?: string; city?: string; lat?: number; lng?: number };
  className?: string;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [slowTimer, setSlowTimer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greetingText = greeting || DEFAULT_GREETINGS[mode];
  const showExamples = messages.length === 0 && !showHistory;

  async function loadHistory() {
    if (historyMessages.length > 0) {
      setShowHistory(true);
      return;
    }
    setHistoryLoading(true);
    try {
      const history = await api.stylistMessages();
      if (history.length > 0) {
        setHistoryMessages(
          history.map((m: StylistMessage) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        );
      }
      setShowHistory(true);
    } catch {}
    setHistoryLoading(false);
  }

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduce ? "instant" : "smooth",
    });
  }, [reduce]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setSlowTimer(false);
    onSend?.();

    const timer = setTimeout(() => setSlowTimer(true), 5000);

    try {
      if (mode === "stylist") {
        const res = await api.stylistChat(text);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
          results: res.results ?? undefined,
          currency: res.currency,
          shopQuery: res.search_query ?? undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onSuggestion?.(res.reply);
        if (res.outfit_id) {
          onStylistResult?.({
            reasoning: res.reply,
            item_ids: res.outfit_item_ids ?? [],
            outfit_id: res.outfit_id,
            decline: false,
          });
        }
        if (res.results && onSearchResults) {
          onSearchResults(res.results, res.currency, res.no_local, undefined);
        }
      } else {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await api.shoppingAsk(text, history, location);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
          searchTriggered: !!res.results,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (res.results && onSearchResults) {
          onSearchResults(res.results ?? [], res.currency, res.no_local, res.city ?? undefined);
        }
      }
    } catch {
      clearTimeout(timer);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Something went wrong — tap to retry",
        chips: ["Try again"],
      };
      setMessages((prev) => [...prev, errorMsg]);
      if (mode === "stylist") {
        onStylistResult?.({ decline: true, item_ids: [], outfit_id: "", reasoning: "" });
      }
    } finally {
      setSending(false);
      setSlowTimer(false);
    }
  }

  function handleChip(chip: string) {
    if (chip === "Try again" && messages.length >= 2) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setMessages((prev) => prev.slice(0, -1));
        setInput(lastUserMsg.content);
        setTimeout(() => inputRef.current?.form?.requestSubmit(), 50);
        return;
      }
    }
    setInput(chip);
    setTimeout(() => inputRef.current?.form?.requestSubmit(), 50);
  }

  return (
    <div className={"flex flex-col " + className}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5 min-h-0"
      >
        {/* Greeting + history toggle */}
        <div className="flex justify-start">
          <div className="max-w-[44ch] text-[17px] leading-snug text-accent">
            {greetingText}
          </div>
        </div>

        {mode === "stylist" && messages.length === 0 && !showHistory && (
          <button
            type="button"
            onClick={loadHistory}
            disabled={historyLoading}
            className="text-[13px] text-muted hover:text-ink transition-colors flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {historyLoading ? "Loading..." : "View past conversations"}
          </button>
        )}

        {/* Past history (on demand) */}
        {showHistory && historyMessages.length > 0 && (
          <div className="space-y-2 border-b border-line/40 pb-3 mb-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[13px] text-muted">Past messages</span>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="text-[13px] text-muted hover:text-ink transition-colors underline underline-offset-4"
              >
                Hide
              </button>
            </div>
            {historyMessages.map((msg) => (
              <div
                key={msg.id}
                className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={
                    "opacity-60 " +
                    (msg.role === "user"
                      ? "max-w-[34ch] px-4 py-2.5 text-[15px] rounded-2xl rounded-br-md bg-lilac text-ink"
                      : "max-w-[44ch] text-[16px] leading-snug text-accent")
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
        {showHistory && historyMessages.length === 0 && !historyLoading && (
          <p className="text-[13px] text-muted">No past conversations yet</p>
        )}

        {/* Example prompts */}
        {showExamples && (
          <p className="text-[13px] text-muted">
            Try {EXAMPLE_PROMPTS[mode]}
          </p>
        )}

        {/* Messages */}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={"flex " + (msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div>
                <div
                  className={
                    (msg.role === "user"
                      ? "ml-auto max-w-[34ch] px-4 py-2.5 text-[15px] rounded-2xl rounded-br-md bg-lilac text-ink"
                      : "max-w-[44ch] text-[17px] leading-snug text-accent")
                  }
                >
                  {msg.content}
                  {msg.searchTriggered && (
                    <span className="block mt-1 text-[13px] text-muted">
                      Results are below
                    </span>
                  )}
                </div>
                {/* Chips */}
                {msg.chips && msg.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.chips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleChip(chip)}
                        className="chip hover:border-ink transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                {msg.shopQuery && (
                  <button
                    type="button"
                    onClick={() => router.push(`/shop?q=${encodeURIComponent(msg.shopQuery!)}&from=stylist`)}
                    className="mt-3 btn-link"
                  >
                    Shop these
                  </button>
                )}
                {msg.results && msg.results.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1 max-w-md">
                    {msg.results.slice(0, 6).map((r, i) => (
                      <a
                        key={i}
                        href={r.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-28 rounded-xl2 overflow-hidden border border-line bg-surface hover:border-accent transition-colors"
                      >
                        <div className="aspect-[3/4] bg-surface2">
                          {r.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[12px] leading-tight line-clamp-2">{r.title}</p>
                          <p className="text-[12px] font-semibold mt-1">
                            {r.price != null ? `${r.approx ? "~" : ""}${msg.currency || "USD"} ${r.price.toFixed(0)}` : r.source}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {sending && (
          <div className="flex justify-start">
            <div className="py-2 flex items-center gap-1.5" role="status" aria-label="Stylist is replying">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse [animation-delay:300ms]" />
              {slowTimer && (
                <span className="text-[13px] text-muted ml-2">Still working on it</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 px-4 sm:px-6 py-4 border-t border-line"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your stylist..."
          disabled={sending}
          className="field flex-1 h-11 py-0"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary"
        >
          Send
        </button>
      </form>
    </div>
  );
}
