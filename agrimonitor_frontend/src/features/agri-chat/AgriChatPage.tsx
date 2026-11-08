import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/client";
import { getAgriChatStatus, streamAgriChat } from "../../api/agriChat";
import type { AgriChatMessage, AgriChatStatus } from "../../api/agriChat";

type DisplayMessage = AgriChatMessage & { id: number };

export function AgriChatPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [status, setStatus] = useState<AgriChatStatus | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const requestController = useRef<AbortController | null>(null);
  const messageEnd = useRef<HTMLDivElement>(null);
  const nextMessageId = useRef(0);

  useEffect(() => {
    let active = true;
    getAgriChatStatus()
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setStatus({
            available: false,
            model: "",
            message: requestError instanceof ApiError ? requestError.message : t("agriChat.statusUnavailable"),
          });
        }
      });
    return () => {
      active = false;
      requestController.current?.abort();
    };
  }, [t]);

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function sendMessage(rawMessage: string) {
    const content = rawMessage.trim();
    if (!content || isSending || !status?.available) return;

    const userMessage: DisplayMessage = { id: ++nextMessageId.current, role: "user", content };
    const assistantId = ++nextMessageId.current;
    const assistantMessage: DisplayMessage = { id: assistantId, role: "assistant", content: "" };
    const requestMessages = [
      ...messages.slice(-9).map(({ role, content: messageContent }) => ({ role, content: messageContent })),
      { role: "user" as const, content },
    ];
    const controller = new AbortController();
    requestController.current = controller;
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      await streamAgriChat(
        requestMessages,
        (chunk) => {
          setMessages((current) => current.map((message) =>
            message.id === assistantId ? { ...message, content: message.content + chunk } : message,
          ));
        },
        controller.signal,
      );
    } catch (requestError) {
      if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
        setError(requestError instanceof Error ? requestError.message : t("agriChat.replyFailed"));
      }
    } finally {
      if (requestController.current === controller) {
        requestController.current = null;
        setMessages((current) => current
          .filter((message) => message.id !== assistantId || message.content)
          .slice(-10));
        setIsSending(false);
      }
    }
  }

  function startNewConversation() {
    requestController.current?.abort();
    requestController.current = null;
    setMessages([]);
    setInput("");
    setError("");
    setIsSending(false);
  }

  const quickQuestions = [
    t("agriChat.question1"),
    t("agriChat.question2"),
    t("agriChat.question3"),
  ];

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-4xl flex-col overflow-hidden rounded-2xl border border-field-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <h1 className="text-lg font-bold text-slate-950">{t("agriChat.title")}</h1>
          <p className="mt-1 text-sm text-slate-600">{t("agriChat.description")}</p>
        </div>
        <button className="neo-button px-3 py-2 text-sm font-semibold" type="button" onClick={startNewConversation}>
          {t("agriChat.newConversation")}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        <div className={`rounded-lg px-4 py-3 text-sm ${status?.available ? "bg-field-50 text-field-800" : "bg-amber-50 text-amber-900"}`} role="status">
          {!status ? t("agriChat.checkingStatus") : status.available
            ? t("agriChat.ready", { model: status.model })
            : status.message}
        </div>

        {messages.length === 0 ? (
          <div className="my-auto">
            <p className="mb-4 max-w-xl text-sm leading-6 text-slate-700">{t("agriChat.welcome")}</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <button
                  className="neo-button rounded-full px-3 py-2 text-left text-sm text-slate-700"
                  disabled={!status?.available || isSending}
                  key={question}
                  onClick={() => void sendMessage(question)}
                  type="button"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[80%] ${message.role === "user" ? "ml-auto bg-field-700 text-white" : "mr-auto border border-slate-100 bg-slate-50 text-slate-800"}`}
              key={message.id}
            >
              {message.content || (isSending && message.role === "assistant" ? t("agriChat.thinking") : "")}
            </div>
          ))
        )}
        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        <div ref={messageEnd} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-slate-100 p-3 sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void sendMessage(input);
        }}
      >
        <label className="sr-only" htmlFor="agri-chat-message">{t("agriChat.messageLabel")}</label>
        <textarea
          className="neo-control min-h-12 flex-1 resize-y px-4 py-3 text-sm text-slate-900"
          disabled={!status?.available || isSending}
          id="agri-chat-message"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage(input);
            }
          }}
          placeholder={t("agriChat.placeholder")}
          rows={1}
          value={input}
        />
        <button
          className="neo-button neo-button-primary min-h-12 px-4 py-3 text-sm font-semibold"
          disabled={!status?.available || isSending || !input.trim()}
          type="submit"
        >
          {isSending ? t("agriChat.sending") : t("agriChat.send")}
        </button>
      </form>
    </section>
  );
}
