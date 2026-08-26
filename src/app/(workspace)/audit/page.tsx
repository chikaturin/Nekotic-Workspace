import { APP_NAME } from "@/config/app";
import { AuditPage } from "@/components/audit/audit-page";

export const metadata = { title: `Audit log · ${APP_NAME}` };

export default function AuditRoute() {
  return <AuditPage />;
}
