// https://react.dev/learn/typescript#typing-children
import "./CenteredList.css";

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
