import type { Route } from "./+types/home";
import { About } from "../about/about";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Angad Behl - Home" },
    { name: "description", content: "Student, software developer, and photographer." },
  ];
}

export default function Home() {
  return <About />;
}
