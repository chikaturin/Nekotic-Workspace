import { redirect } from "next/navigation";
import { DRIVE_ROOT_PATH } from "@/config/app";

export default function WorkspaceHomePage() {
  redirect(DRIVE_ROOT_PATH);
}
