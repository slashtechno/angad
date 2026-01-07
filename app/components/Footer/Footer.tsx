import { Link, useLocation } from "react-router";
import "./Footer.css"
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
        <script data-goatcounter="https://sudo.goatcounter.com/count"
        async src="/assets/count.js"></script>
        </footer>
    );
    }