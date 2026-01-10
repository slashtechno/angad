import { About } from "../../components/About/About";
import type { Route } from "./+types/route";
import "./home.css";
import LinkList from "~/components/LinkList/LinkList";

// > Since React 19, using the built-in <meta> element is recommended over the use of the route module's meta export. (https://reactrouter.com/start/framework/rou1te-module#meta)
// export function meta({}: Route.MetaArgs) {
//   return [
//     { title: "Angad Behl - Home" },
//     {
//       name: "description",
//       content: "Student, software developer, and photographer.",
//     },
//   ];
/**
 * Renders the site's homepage containing the document title and meta description, an About section, and a navigation list of links.
 *
 * @returns The JSX element representing the homepage.
 */

export default function Home() {
  return (
    <div id="homepage">
      <title >Angad Behl - Home</title>
      <meta name="description" content="Student, software developer, and photographer." />
      <div id="about">
        <About />
      </div>
      <nav>
        <LinkList
          links={[
            // { href: "#about", label: "About" },
            { href: "/musings", label: "Musings" },
            { href: "https://github.com/slashtechno", label: "GitHub (projects)" },
            { href: "https://instagram.com/angadbehl", label: "Photography" },
            { href: "https://meet.angad.me", label: "Schedule a meeting" },

          ]}
          textSize={"2.75rem"}
        />
      </nav>
    </div>
  );
}