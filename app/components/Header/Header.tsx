import { Link, useLocation } from "react-router";
import "./header.css"
/**
     * Render the application header containing an optional back-navigation link and the GoatCounter script.
     *
     * The back-navigation link is omitted on the root path ("/"); on other paths it points to the appropriate
     * destination and displays contextual text for musings-related routes.
     *
     * @returns A JSX `header` element that may include a back-navigation `Link` and always includes the GoatCounter script.
     */
    export default function Header() {
    // We need the location so we can conditionally render the "Back home" link
    // https://reactrouter.com/api/hooks/useLocation
    let location = useLocation();

    return (
        <header>
        {/* Hide back to home on / (https://react.dev/learn/conditional-rendering#logical-and-operator-) */}
        {location.pathname !== "/" && (
        <div className="links">
            <Link to={location.pathname === "/musings" ? "/" : location.pathname.startsWith("/musings/") ? "/musings" : "/"} id="name">{location.pathname === "/musings" ? "Angad Behl's" : location.pathname.startsWith("/musings/") ? "<- Back to musings" : "<- Back home"}</Link>
        </div>
        )}
        <script data-goatcounter="https://sudo.goatcounter.com/count"
        async src="/assets/count.js"></script>
        </header>
    );
    }