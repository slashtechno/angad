import type { Route } from "./+types/home";
import { About } from "../components/about/about";
import "./home.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Angad Behl - Home" },
    { name: "description", content: "Student, software developer, and photographer." },
  ];
}

export default function Home() {
  return (
    <>
      {/* 
        Centered nav list using flexbox
        - flex-direction: column stacks links vertically
        - justify-content: center centers them on the vertical axis
        - align-items: center centers them on the horizontal axis
        - height: 100vh makes it take up full viewport height
      */}
      <About />
      <nav className="centered-nav">
        <a href="#about">About</a>
        <a href="#projects">Projects</a>
        <a href="#contact">Contact</a>
      </nav>
    </>
  );
}
