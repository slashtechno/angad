import { Link, useLocation } from "react-router";
import "./Footer.css"
export default function Footer() {
    // https://reactrouter.com/api/hooks/useLocation
    let location = useLocation();

    return (
        <footer>
        <p>© 2026 Angad Behl. All rights reserved.</p>
        {/* https://react.dev/learn/conditional-rendering#logical-and-operator- */}
        {location.pathname !== "/" && (
        <div className="links">
            {/* With the magic of Inter's contextual alternates, this becomes an arrow */}
            <Link to="/">{"<-"} Back home</Link>
        </div>
        )}
        </footer>
    );
    }