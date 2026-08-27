import { APP_NAME } from "@/config/app";
import { DesignSystemPage } from "@/components/design-system/design-system-page";

export const metadata = { title: `Design system · ${APP_NAME}` };

export default function DesignSystemRoute() {
  return <DesignSystemPage />;
}
