// https://vite.dev/guide/assets.html#importing-asset-as-string
// https://vite.dev/guide/features#glob-import
// https://vite.dev/guide/features#custom-queries (used with glob for raw import)
// https://reactrouter.com/start/framework/data-loading#static-data-loading (this can be made into a static site even though we are dynamically loading data)
// https://reactrouter.com/how-to/file-route-conventions#nested-urls-without-layout-nesting (why we have te _)

import LinkList from "~/components/LinkList/LinkList";
import type { Route } from "./+types/route";
import { loadAllPostsParsed } from "~/.server/posts";
import "./musings.css";

/**
 * Load all parsed posts and provide them to the route.
 *
 * This also primes the posts module cache used for subsequent individual post lookups.
 *
 * @returns An object with `parsedPosts`: an array of parsed post entries
 */
export async function loader({ params }: Route.LoaderArgs) {
    // Load all posts. Also caches them in allPosts variable in posts.ts
    // When a post is requested individually, that cache is used by getPostByPath.
    const parsedPosts = await loadAllPostsParsed(); 
    
    return {parsedPosts};
}

/**
 * Render the Musings page with a heading and a list of links to parsed posts.
 *
 * @param loaderData - Route loader data containing `parsedPosts`, an array of parsed post objects used to build link items (`href` from `post.relativeHref`, `label` from `post.frontmatter.title`)
 * @returns The React element for the Musings page containing an H1 and a LinkList of post links
 */
export default function MusingsRoute({loaderData}: Route.ComponentProps) {
    const {parsedPosts} = loaderData;
    
return (
    <div className="musings-container">
        <h1>Musings</h1>
        <LinkList links={
            parsedPosts.map( (post) => ({
                href: post.relativeHref,
                label: post.frontmatter.title
            }) )

        }/>
    </div>
)
}   

/* Destructuring an array in the for of key-value using map:
const MyObject = {
  name: 'Jeff',
  personality: 'Wild',
  isAwesome: true
};

Object.entries(MyObject).map( ([key, value]) => {
    console.log(key);  // 'name', 'personality', 'isAwesome'
    console.log(value); // 'Jeff', 'Wild', true
})

source: https://www.modernjsbyexample.net/book/002-variables
*/