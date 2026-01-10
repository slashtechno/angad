// https://react.dev/learn/typescript#typing-children
import "./CenteredList.css";

/**
 * Render a container that centers its children using the `centered-nav` class.
 *
 * @param children - Content to render inside the centered container.
 * @param style - Optional inline styles applied to the container.
 * @returns A `div` element with class `centered-nav` containing `children` and the optional `style`.
 */
export default function CenteredList({
  children,
  style
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {

  // https://react.dev/learn/javascript-in-jsx-with-curly-braces#using-double-curlies-css-and-other-objects-in-jsx
  return <div className="centered-nav" style={style}>{children}</div>;
}