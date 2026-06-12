import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Plus, MessageSquare, Mic, MicOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/platform/supabase/browser";
import { trackEvent } from "@/lib/analytics";
import {
  createThreadServerFn,
  listThreadsServerFn,
  listMessagesServerFn,
  sendMessageServerFn,
  type DealThreadRow,
  type DealMessageRow,
} from "@/serverFns/dealChat";

// ─── Query keys ───────────────────────────────────────────────────────────────

const dealChatKeys = {
  threads: (oppId: string) => ["deal-threads", oppId] as const,
  messages: (threadId: string) => ["deal-messages", threadId] as const,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DealChat({ opportunityId }: { opportunityId: string }) {
  const queryClient = useQueryClient();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch threads
  const { data: threads = [] } = useQuery({
    queryKey: dealChatKeys.threads(opportunityId),
    queryFn: () => listThreadsServerFn({ data: { opportunityId } }),
  });

  // Auto-select first thread when loaded
  useEffect(() => {
    if (threads.length > 0 && !selectedThreadId) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  // Fetch messages for selected thread
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: dealChatKeys.messages(selectedThreadId ?? ""),
    queryFn: () => listMessagesServerFn({ data: { threadId: selectedThreadId! } }),
    enabled: !!selectedThreadId,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedThreadId) return;

    const channel = supabase
      .channel(`deal-messages-${selectedThreadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "deal_messages",
          filter: `thread_id=eq.${selectedThreadId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: dealChatKeys.messages(selectedThreadId),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, queryClient]);

  // Create thread
  const createThreadMutation = useMutation({
    mutationFn: () =>
      createThreadServerFn({
        data: { opportunityId, title: `Thread ${threads.length + 1}` },
      }),
    onSuccess: (thread) => {
      queryClient.invalidateQueries({ queryKey: dealChatKeys.threads(opportunityId) });
      setSelectedThreadId(thread.id);
      trackEvent("deal_thread_created");
    },
  });

  // Send message
  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      sendMessageServerFn({
        data: { threadId: selectedThreadId!, content, opportunityId },
      }),
    onMutate: async (content) => {
      // Optimistic user message
      const key = dealChatKeys.messages(selectedThreadId!);
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<DealMessageRow[]>(key) ?? [];
      const optimistic: DealMessageRow = {
        id: `opt-${Date.now()}`,
        thread_id: selectedThreadId!,
        role: "user",
        content,
        structured_output: null,
        metadata: {},
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<DealMessageRow[]>(key, [...prev, optimistic]);
      setDraft("");
      return { prev };
    },
    onSuccess: ({ userMessage, assistantMessage }) => {
      queryClient.setQueryData<DealMessageRow[]>(
        dealChatKeys.messages(selectedThreadId!),
        (old = []) => {
          // Replace optimistic message with real, then add assistant reply
          const withoutOptimistic = old.filter((m) => !m.id.startsWith("opt-"));
          return [...withoutOptimistic, userMessage, assistantMessage];
        },
      );
      trackEvent("deal_message_sent");
    },
    onError: (_err, _content, context) => {
      if (context?.prev) {
        queryClient.setQueryData(dealChatKeys.messages(selectedThreadId!), context.prev);
      }
    },
  });

  // Voice input
  const toggleVoice = () => {
    const SpeechRecognition =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Try Chrome.");
      return;
    }

    if (isListening) {
<<<<<<< HEAD
=======
      recognitionRef.current?.abort?.();
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
>>>>>>> origin/main
      setIsListening(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
<<<<<<< HEAD
=======
    recognitionRef.current = recognition;
>>>>>>> origin/main
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-GB";

    recognition.onresult = (event: {
      results: { [key: number]: { [key: number]: { transcript: string } } };
    }) => {
      const transcript = event.results[0][0].transcript;
      setDraft((d) => (d ? `${d} ${transcript}` : transcript));
<<<<<<< HEAD
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
=======
      recognitionRef.current = null;
      setIsListening(false);
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
>>>>>>> origin/main

    recognition.start();
    setIsListening(true);
  };

  const handleSend = () => {
    if (!draft.trim() || !selectedThreadId || sendMutation.isPending) return;
    sendMutation.mutate(draft.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent" />
            <h2 className="text-base font-semibold text-foreground">Deal Copilot Chat</h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Thread selector */}
            {threads.length > 0 && (
              <select
                className="text-xs rounded border border-border bg-background px-2 py-1 text-foreground"
                value={selectedThreadId ?? ""}
                onChange={(e) => setSelectedThreadId(e.target.value)}
              >
                {threads.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title ?? `Thread ${threads.indexOf(t) + 1}`}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => createThreadMutation.mutate()}
              disabled={createThreadMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5" />
              New thread
            </Button>
          </div>
        </div>

        {/* Message list */}
        <div className="flex h-80 flex-col overflow-y-auto p-4">
          {!selectedThreadId ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Create a thread to start chatting about this deal.
            </div>
          ) : messagesLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
              <div>
                <p>Ask anything about this deal.</p>
                <p className="mt-1 text-xs">Risks, comparable values, next steps — anything.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {sendMutation.isPending && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error */}
        {sendMutation.isError && (
          <p className="px-4 pb-2 text-xs text-destructive">
            {sendMutation.error instanceof Error
              ? sendMutation.error.message
              : "Failed to send message."}
          </p>
        )}

        {/* Input */}
        {selectedThreadId && (
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                className="min-h-[40px] max-h-32 resize-none text-sm"
                placeholder="Ask about this deal… (Enter to send, Shift+Enter for newline)"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendMutation.isPending}
                rows={1}
              />
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="px-3"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant={isListening ? "destructive" : "outline"}
                  onClick={toggleVoice}
                  title={isListening ? "Stop listening" : "Voice input"}
                  className="px-3"
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: DealMessageRow }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-6 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-secondary/40 text-foreground"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        <p className={`mt-0.5 text-[10px] opacity-60 ${isUser ? "text-right" : ""}`}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 px-3 py-2">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
      </div>
    </div>
  );
}
