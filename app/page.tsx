import { supabase } from "@/lib/supabase";
import { EmailViewer, type EmailLog } from "@/components/email-viewer";

export const revalidate = 0;

async function removeOldEmailLogs() {
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("NovuWebhookLogs")
    .delete()
    .lt("received_at", cutoff);

  if (error) {
    console.error("Failed to purge outdated Novu webhook logs", error);
  }
}

async function getEmailLogs(): Promise<EmailLog[]> {
  await removeOldEmailLogs();

  const { data, error } = await supabase
    .from("NovuWebhookLogs")
    .select("id, received_at, data")
    .order("received_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch Novu webhook logs", error);
    return [];
  }

  return (
    data?.map((item) => ({
      id: item.id as number,
      received_at: item.received_at as string | null,
      data: (item.data ?? {}) as EmailLog["data"],
    })) ?? []
  );
}

export default async function HomePage() {
  const emails = await getEmailLogs();

  return <EmailViewer emails={emails} />;
}
