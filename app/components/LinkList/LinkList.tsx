import { Link } from "react-router";
import CenteredList from "../CenteredList/CenteredList";

/**
 * Render a centered list of links, using external anchors for absolute URLs and react-router Links for internal paths.
 *
 * Displays each entry from `links` inside a CenteredList. If `textSize` is provided, it is applied via the `--link-font-size` CSS variable on the container.
 *
 * @param links - Array of link objects, each with `href` (URL or internal path) and `label` (visible text).
 * @param textSize - Optional CSS fontSize value applied to the list via the `--link-font-size` custom property.
 * @returns A React element containing the rendered list of links.
 */
export default function LinkList({
  links,
  textSize,
}: {
  links: { href: string; label: string }[];
  textSize?: React.CSSProperties["fontSize"];
}) {
  return (
    <CenteredList
    style={
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_operator
        // If textSize is provided, set the --link-font-size CSS variable
        textSize
          ? ({ "--link-font-size": textSize } as React.CSSProperties)
          : {}
      }
    >
      {
        // https://www.freecodecamp.org/news/4-main-differences-between-foreach-and-map/#:~:text=1.%20The%20returning%20value
        // https://nextjs.org/learn/react-foundations/displaying-data-with-props#iterating-through-lists
        // https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key
      }
      {links.map((link) => {
        if (link.href.startsWith("http")) {
          return (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              key={link.href}
            >
              {link.label}
            </a>
          );
        } else {
          return (
            <Link to={link.href} key={link.href}>
              {link.label}
            </Link>
          );
        }
      })}
    </CenteredList>
  );
}