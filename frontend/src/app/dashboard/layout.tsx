import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { AssistantWidget } from '@/components/assistant-widget';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <AssistantWidget />
    </div>
  );
}
