import './about.css';

/**
 * Render an "About" section with a title showing the name and a short descriptive paragraph containing a link to Hack Club.
 *
 * @returns A JSX element containing a container with a heading for "Angad!" and a paragraph describing the author and linking to https://hackclub.com/.
 */
export function About() {
  return (
    <div className="about-container">
      <h1 className="about-title">Hi! I'm <span id="name">Angad!</span></h1>
      <p className="about-description">
        I'm a high-school student, photographer, and software developer. Currently, I'm contracting @ <a href="https://hackclub.com/">Hack Club</a> doing software development. 
      </p>
    </div>
  );
}