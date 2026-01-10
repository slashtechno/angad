import { Link, useLocation } from "react-router";
import "./Footer.css"
/**
     * Footer component that renders copyright information and a conditional "Back home" link.
     *
     * Uses the current location to hide the "Back home" link when the user is on the root path ("/").
     *
     * @returns A `<footer>` JSX element containing the copyright line and, when the current path is not `/`, a "Back home" `Link` pointing to `/`.
     */
    export default function Footer() {
    // We need the location so we can conditionally render the "Back home" link
    // https://reactrouter.com/api/hooks/useLocation
    let location = useLocation();

    return (
        <footer>
        <p>© 2026 Angad Behl. All rights reserved.</p>
        {/* Hide back to home on / (https://react.dev/learn/conditional-rendering#logical-and-operator-) */}
        {location.pathname !== "/" && (
        <div className="links">
            {/* With the magic of Inter's contextual alternates, this becomes an arrow */}
            <Link to="/">{"<-"} Back home</Link>
        </div>
        )}
        </footer>
    );
    }