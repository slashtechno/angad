import { Link } from "react-router";
import CenteredList from "../CenteredList/CenteredList";

export default function LinkList({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  // https://www.freecodecamp.org/news/4-main-differences-between-foreach-and-map/#:~:text=1.%20The%20returning%20value
  // https://nextjs.org/learn/react-foundations/displaying-data-with-props#iterating-through-lists
  return (
    <CenteredList>
      {links.map((link) => {
        if (link.href.startsWith('http')) {
          return <a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
        } else {
          return <Link to={link.href}>{link.label}</Link>
        }
      })}
    </CenteredList>
  );
}
