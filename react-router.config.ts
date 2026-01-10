import type { Config } from "@react-router/dev/config";
import { loadAllPostsParsed } from "./app/.server/posts";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`

  // https://reactrouter.com/start/framework/data-loading#static-data-loading
  async prerender() {
    // Load all posts to generate routes for each musing
    const posts = await loadAllPostsParsed();
    
    // Generate prerender routes for all posts
    const musingRoutes = posts.map((post) => post.relativeHref);

    console.debug("Prerendering routes for musings:", musingRoutes);
    
    // Return all routes to prerender: home, musings list, and all individual musings
    return [
      "/",
      "/musings",
      ...musingRoutes,
    ];
  },

  ssr: false,


} satisfies Config;
