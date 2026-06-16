import { redirect } from "react-router";
import type { Route } from "./+types/route";

export function loader({ params }: Route.LoaderArgs) {
  const { year, "*": splat } = params;
  return redirect(`/musings/${year}/${splat}`, 301);
}

export default function BlogRedirect() {
  return null;
}
