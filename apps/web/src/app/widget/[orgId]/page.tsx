import { ChatWidget } from "@/components/chat/ChatWidget";

const API_URL = process.env.API_INTERNAL_URL || "http://localhost:3001";

interface WidgetPageProps {
  params: { orgId: string };
  searchParams: { key?: string };
}

async function getWidgetConfig(orgId: string) {
  try {
    const res = await fetch(`${API_URL}/api/widget/${orgId}/config`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export default async function WidgetPage({ params, searchParams }: WidgetPageProps) {
  const config = await getWidgetConfig(params.orgId);
  const apiKey = searchParams.key ?? "";

  if (!config) {
    return (
      <div className="h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">
        Widget not found or organisation inactive.
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden">
      <ChatWidget
        orgId={params.orgId}
        apiKey={apiKey}
        widgetColor={config.widgetColor}
        greeting={config.widgetGreeting}
        orgName={config.name}
      />
    </div>
  );
}

// Tell Next.js this page can be embedded in iframes
export const dynamic = "force-dynamic";
