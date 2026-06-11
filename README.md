# [angad.me](https://angad.me): My Personal Website

I rewrote my entire website in React and in the process, ended up making my own static site generator.

The static site generator is much simpler than a dedicated one like Hugo, but still maintains the features I need:
- All posts are written in Markdown
- Post metadata is stored as YAML frontmatter
- Support for relative images
    - Allows te images to be placed in the same folder as the Markdown files

I mainly used this project to get more familiar with React (through React Router) and styling with vanilla CSS. 

## Building and Running Locally
(I use bun, but you should be able to use most Node.js package managers, like npm
1. Clone the repository
2. Install dependencies with `bun install`
3. Run the development server with `bun run dev`