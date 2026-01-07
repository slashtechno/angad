import { Link } from "react-router";
import "./Footer.css"
export default function Footer() {
    return (
        <footer>
        <p>© 2026 Angad Behl. All rights reserved.</p>
        <div className="links">
            <Link to="/">{"<-"} Back home</Link>
        </div>
        </footer>
    );
    }