import { redirect } from "next/navigation";

/** Home → canonical new-chat URL (Claude-style /new). */
export default function HomePage() {
  redirect("/new");
}
