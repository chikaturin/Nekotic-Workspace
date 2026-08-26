import { APP_NAME } from "@/config/app";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const metadata = { title: `Dashboard · ${APP_NAME}` };

export default function DashboardRoute() {
  return <DashboardPage />;
}
