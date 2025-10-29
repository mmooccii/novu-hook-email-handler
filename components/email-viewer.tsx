"use client";

import { useMemo, useState } from "react";

export type EmailPayload = {
  to?: unknown;
  from?: string | null;
  subject?: string | null;
  html?: string | null;
  [key: string]: unknown;
};

export type EmailLog = {
  id: number;
  received_at: string | null;
  data: EmailPayload;
};

function formatRecipient(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .flat()
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "email" in item) {
          const email = (item as { email?: string }).email;
          return email ?? "";
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function formatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type EmailViewerProps = {
  emails: EmailLog[];
};

export function EmailViewer({ emails }: EmailViewerProps) {
  const [selectedId, setSelectedId] = useState(emails[0]?.id ?? null);

  const selectedEmail = useMemo(
    () => emails.find((email) => email.id === selectedId) ?? emails[0],
    [emails, selectedId],
  );

  const subject = selectedEmail?.data.subject ?? "(no subject)";
  const from = selectedEmail?.data.from ?? "";
  const to = formatRecipient(selectedEmail?.data.to);
  const html = selectedEmail?.data.html ?? "";

  return (
    <div className="flex h-dvh flex-col bg-zinc-100 text-zinc-900 md:flex-row">
      <aside className="md:w-80 lg:w-96 border-b border-zinc-200 bg-white md:h-full md:min-h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">メール一覧</h1>
          <span className="text-xs text-zinc-500">{emails.length}件</span>
        </div>
        <div className="max-h-[40vh] overflow-y-auto md:h-[calc(100vh-4.5rem)]">
          {emails.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">保存されたメールがありません。</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {emails.map((email) => {
                const emailSubject = email.data.subject ?? "(no subject)";
                const emailFrom = email.data.from ?? "";
                const emailTo = formatRecipient(email.data.to);
                const receivedAt = formatDate(email.received_at);
                const isActive = email.id === selectedEmail?.id;

                return (
                  <li key={email.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(email.id)}
                      className={`flex w-full flex-col gap-1 px-5 py-4 text-left transition hover:bg-zinc-50 focus:outline-none focus-visible:bg-zinc-100 ${
                        isActive ? "bg-zinc-100" : "bg-white"
                      }`}
                    >
                      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                        {receivedAt}
                      </span>
                      <span className="truncate text-sm font-semibold text-zinc-900">
                        {emailSubject}
                      </span>
                      <span className="truncate text-xs text-zinc-500">From: {emailFrom}</span>
                      {emailTo && (
                        <span className="truncate text-xs text-zinc-500">To: {emailTo}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
      <section className="flex flex-1 flex-col">
        {selectedEmail ? (
          <>
            <header className="border-b border-zinc-200 bg-white px-8 py-6">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-zinc-500">{formatDate(selectedEmail.received_at)}</p>
                <h2 className="text-2xl font-semibold text-zinc-900">{subject}</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600">
                {from && (
                  <p>
                    <span className="font-medium">From:</span> {from}
                  </p>
                )}
                {to && (
                  <p>
                    <span className="font-medium">To:</span> {to}
                  </p>
                )}
              </div>
            </header>
            <div className="flex-1 bg-zinc-200 p-4">
              {html ? (
                <iframe
                  key={selectedEmail.id}
                  title={`Email content ${selectedEmail.id}`}
                  srcDoc={html}
                  sandbox="allow-same-origin"
                  className="h-full w-full rounded-lg border border-zinc-300 bg-white shadow-sm"
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-sm text-zinc-500">
                  HTML ボディが空です。
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            メールが選択されていません。
          </div>
        )}
      </section>
    </div>
  );
}
