import { redirect } from "next/navigation";

/** No splash screen: the root URL goes straight to the landing page. */
export default function Index() {
  redirect("/welcome");
}
