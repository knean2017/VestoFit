"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { api } from "@/lib/api";
import type { ShoppingResultItem, StylistMessage } from "@/lib/api";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: string[];
  searchTriggered?: boolean;
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
  greeting,
  className = "",
}: {
  mode: "stylist" | "shopping";
  onSearchResults?: (results: ShoppingResultItem[]) => void;
  onSuggestion?: (reasoning: string) => void;
  greeting?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [slowTimer, setSlowTimer] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(mode !== "stylist");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greetingText = greeting || DEFAULT_GREETINGS[mode];
  const showExamples = messages.length === 0;

  useEffect(() => {
    if (mode !== "stylist") return;
    let cancelled = false;
    (async () => {
      try {
        const history = await api.stylistMessages();
        if (cancelled) return;
        if (history.length > 0) {
          setMessages(
            history.map((m: StylistMessage) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          );
        }
      } catch {}
      setHistoryLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [mode]);

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

    const timer = setTimeout(() => setSlowTimer(true), 5000);

    try {
      if (mode === "stylist") {
        const res = await api.stylistAsk(text);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onSuggestion?.(res.reply);
      } else {
        const history = messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await api.shoppingAsk(text, history);
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
          onSearchResults(res.results);
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

  if (mode === "stylist" && !historyLoaded) return null;

  return (
    <div className={"flex flex-col " + className}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
      >
        {/* Greeting */}
        <div className="flex justify-start">
          <div className="max-w-md rounded-xl3 px-4 py-2.5 text-sm bg-surface2 text-ink rounded-bl-lg">
            {greetingText}
          </div>
        </div>

        {/* Example prompts */}
        {showExamples && (
          <p className="text-xs text-muted/50 px-1 italic">
            Try: {EXAMPLE_PROMPTS[mode]}
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
                    "max-w-md rounded-xl3 px-4 py-2.5 text-sm " +
                    (msg.role === "user"
                      ? "bg-coral text-white rounded-br-lg"
                      : "bg-surface2 text-ink rounded-bl-lg")
                  }
                >
                  {msg.content}
                  {msg.searchTriggered && (
                    <span className="block mt-1 text-[10px] text-muted">
                      ↓ Results below
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
                        className="chip text-xs hover:bg-coralSoft hover:text-coral transition-colors"
                      >
                        {chip}
                      </button>
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
            <div className="bg-surface2 rounded-xl3 rounded-bl-lg px-4 py-3 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-pulse [animation-delay:300ms]" />
              {slowTimer && (
                <span className="text-xs text-muted ml-2">Still thinking...</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 px-4 py-3 border-t border-line bg-bg"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your stylist..."
          disabled={sending}
          className="field-sm flex-1"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary px-4 py-2 text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}
