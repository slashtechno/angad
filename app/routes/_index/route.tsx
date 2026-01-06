import { About } from "../../components/about/about";
import type { Route } from "./+types/route";
import "./home.css";
import LinkList from "~/components/LinkList/LinkList";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Angad Behl - Home" },
    {
      name: "description",
      content: "Student, software developer, and photographer.",
    },
  ];
}

export default function Home() {
  return (
    <div id="homepage">
      <div id="about">
        <About />
      </div>
<nav>
  <LinkList links={[
    // { href: "#about", label: "About" },
    { href: "https://github.com/slashtechno", label: "Projects" },
    // { href: "#contact", label: "Contact" },
  ]} />
</nav>
    </div>
  );
}
