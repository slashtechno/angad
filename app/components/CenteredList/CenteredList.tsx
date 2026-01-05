// https://react.dev/learn/typescript#typing-children
export default function CenteredList({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="centered-nav">{children}</div>;
}
