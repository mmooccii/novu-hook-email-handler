"use client";

import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

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

const THREE_DAYS_IN_MS = 3 * 24 * 60 * 60 * 1000;

function getTimestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;

  const date = new Date(value);
  const time = date.getTime();

  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function filterAndSortEmails(emails: EmailLog[]): EmailLog[] {
  const cutoff = Date.now() - THREE_DAYS_IN_MS;
  const uniqueEmails = new Map<number, EmailLog>();

  emails.forEach((email) => {
    uniqueEmails.set(email.id, email);
  });

  return Array.from(uniqueEmails.values())
    .filter((email) => {
      if (!email.received_at) return true;
      const time = getTimestamp(email.received_at);
      return time >= cutoff;
    })
    .sort((a, b) => getTimestamp(b.received_at) - getTimestamp(a.received_at))
    .slice(0, 50);
}

function normalizeEmailLog(entry: {
  id: number;
  received_at: string | null;
  data?: EmailPayload | null;
}): EmailLog {
  return {
    id: entry.id,
    received_at: entry.received_at,
    data: (entry.data ?? {}) as EmailPayload,
  };
}

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
  const [localEmails, setLocalEmails] = useState<EmailLog[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    emails[0]?.id ?? null,
  );

  const emailList = useMemo(
    () => filterAndSortEmails([...emails, ...localEmails]),
    [emails, localEmails],
  );

  useEffect(() => {
    let isMounted = true;

    const fetchLatest = async () => {
      const { data, error } = await supabase
        .from("NovuWebhookLogs")
        .select("id, received_at, data")
        .order("received_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to refresh Novu webhook logs", error);
        return;
      }

      if (!isMounted) {
        return;
      }

      const normalized = (data ?? []).map((item) =>
        normalizeEmailLog({
          id: item.id as number,
          received_at: item.received_at as string | null,
          data: (item.data ?? {}) as EmailPayload,
        }),
      );

      setLocalEmails(filterAndSortEmails(normalized));
    };

    void fetchLatest();

    const intervalId = setInterval(fetchLatest, 60_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("novu-webhook-logs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "NovuWebhookLogs" },
        (payload) => {
          const newRecord = payload.new as {
            id?: number;
            received_at?: string | null;
            data?: EmailPayload | null;
          };

          if (typeof newRecord?.id !== "number") {
            return;
          }

          const normalized = normalizeEmailLog({
            id: newRecord.id,
            received_at: newRecord.received_at ?? null,
            data: newRecord.data ?? {},
          });

          setLocalEmails((previous) => {
            const uniqueEmails = new Map<number, EmailLog>();

            previous.forEach((email) => {
              uniqueEmails.set(email.id, email);
            });

            uniqueEmails.set(normalized.id, normalized);

            return filterAndSortEmails(Array.from(uniqueEmails.values()));
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const selectedEmail = useMemo(() => {
    const match = emailList.find((email) => email.id === selectedId);
    return match ?? emailList[0] ?? null;
  }, [emailList, selectedId]);

  const subject = selectedEmail?.data.subject ?? "(no subject)";
  const from = selectedEmail?.data.from ?? "";
  const to = formatRecipient(selectedEmail?.data.to);
  const html = selectedEmail?.data.html ?? "";

  return (
    <div className="flex h-dvh flex-col bg-zinc-100 text-zinc-900 md:flex-row">
      <aside className="md:w-80 lg:w-96 border-b border-zinc-200 bg-white md:h-full md:min-h-dvh md:border-b-0 md:border-r">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h1 className="text-lg font-semibold text-zinc-900">メール一覧</h1>
          <span className="text-xs text-zinc-500">{emailList.length}件</span>
        </div>
        <div className="max-h-[40vh] overflow-y-auto md:h-[calc(100vh-4.5rem)]">
          {emailList.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">保存されたメールがありません。</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {emailList.map((email) => {
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
