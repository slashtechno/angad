import { About } from "../../components/About/About";
import { CityLanding } from "../../city/Landing";
import LinkList from "~/components/LinkList/LinkList";
import "./home.css";

// Flip this to switch between the 3D city and the classic landing page.
// `true` = city landing (3D scroll-driven), `false` = classic landing (static).
const USE_CITY_LANDING = true;

export default function Home() {
  if (USE_CITY_LANDING) return <CityLanding />;

  return (
    <div id="homepage">
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
            {href: "https://linkedin.com/in/angadbehl", label: "LinkedIn"},

          ]}
          textSize={"2.75rem"}
        />
      </nav>
    </div>
  );
}