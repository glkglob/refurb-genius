"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { ScrollArea } from "@repo/ui";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  tradeMessagesQueryOptions,
  quoteRequestsByProjectQueryOptions,
} from "@/lib/queries/marketplace";
import { useAuth } from "@/hooks/useAuth";
import {
  useSendTradeMessage,
  resolveTradeMessageRecipient,
  useTradeMessagesRealtime,
} from "@/features/marketplace";

interface MessagingInboxProps {
  projectId?: string;
}

export function MessagingInbox({ projectId }: MessagingInboxProps) {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const { user, isLoading: authLoading, hydrated } = useAuth();
  const userId = user?.id;
  const authReady = hydrated && !authLoading;
  const sendMessageMutation = useSendTradeMessage(userId);
  useTradeMessagesRealtime(selectedQuoteId);

  // Reset selected conversation when the project changes so stale thread IDs
  // from a different project aren't left selected.
  useEffect(() => {
    setSelectedQuoteId(null);
  }, [projectId]);

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    ...quoteRequestsByProjectQueryOptions(projectId || ""),
    enabled: !!projectId,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    ...tradeMessagesQueryOptions(selectedQuoteId || ""),
    enabled: !!selectedQuoteId,
  });

  const handleSendError = (err: Error) => {
    logger.error("[marketplace] send message failed", { error: err.message });
    toast.error("Failed to send message");
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedQuoteId) return;
    if (!authReady) return;
    if (!userId) {
      handleSendError(new Error("You must be signed in"));
      return;
    }
    const quote = quotes.find((q) => q.id === selectedQuoteId);
    if (!quote) {
      handleSendError(new Error("Quote not found"));
      return;
    }
    const recipientId = resolveTradeMessageRecipient({
      currentUserId: userId,
      quoteUserId: quote.user_id,
      quoteTradespersonId: quote.tradesperson_id,
    });
    sendMessageMutation.mutate(
      {
        quoteRequestId: selectedQuoteId,
        recipientId,
        body: newMessage.trim(),
      },
      {
        onSuccess: () => {
          setNewMessage("");
        },
        onError: (err: Error) => {
          handleSendError(err);
        },
      },
    );
  };

  if (!projectId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Link to a project from the Property Detail page to view and manage quote requests and
          messages here.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Quotes list */}
      <Card className="md:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Quote Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quotesLoading ? (
            <div className="p-4 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No quote requests for this project yet. Use the directory to request quotes.
            </div>
          ) : (
            <div className="divide-y">
              {quotes.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className={`w-full text-left p-4 hover:bg-muted/50 transition ${selectedQuoteId === q.id ? "bg-muted" : ""}`}
                >
                  <div className="font-medium text-sm truncate">Quote #{q.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    Status: {q.status} · {new Date(q.created_at).toLocaleDateString()}
                  </div>
                  {q.message && (
                    <div className="text-xs mt-1 line-clamp-1 text-muted-foreground/80">
                      “{q.message}”
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="md:col-span-2 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedQuoteId
              ? `Conversation • ${selectedQuoteId.slice(0, 8)}`
              : "Select a quote request"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          {!selectedQuoteId ? (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
              Select a quote from the left to view messages.
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No messages yet. Send the first one!
                  </p>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                            isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          {msg.content}
                          <div
                            className={`text-[10px] mt-1 opacity-70 ${isMine ? "text-right" : ""}`}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </ScrollArea>

              <form onSubmit={handleSend} className="border-t p-3 flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your reply..."
                  disabled={sendMessageMutation.isPending}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={!newMessage.trim() || sendMessageMutation.isPending || !authReady}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
