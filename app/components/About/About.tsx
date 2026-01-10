import './About.css';

export function About() {
  return (
    <div className="about-container">
      <h1 className="about-title">Hi! I'm <span id="name">Angad!</span></h1>
      <p className="about-description">
        I'm a high-school student, photographer, and software developer. Currently, I'm contracting @ <a href="https://hackclub.com/">Hack Club</a>.
      </p>
    </div>
  );
}