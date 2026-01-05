import type { Route } from "./+types/home";
import { About } from "../components/about/about";
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
      {/* 
        Centered nav list using flexbox
        - flex-direction: column stacks links vertically
        - justify-content: center centers them on the vertical axis
        - align-items: center centers them on the horizontal axis
        - ~~height: 100vh makes it take up full viewport height~~ Right below the about section so we can't do 100vh, since otherwise, it would push the about section offscreen (not necessarily the content, but at least the box)
      */}
      <div id="about">
        <About />
      </div>
<nav>
  <LinkList links={[
    { href: "#about", label: "About" },
    { href: "#projects", label: "Projects" },
    { href: "#contact", label: "Contact" },
  ]} />
</nav>
    </div>
  );
}
