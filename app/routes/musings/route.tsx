// https://vite.dev/guide/assets.html#importing-asset-as-string
// https://vite.dev/guide/features#glob-import
// https://vite.dev/guide/features#custom-queries (used with glob for raw import)
// https://reactrouter.com/start/framework/data-loading#static-data-loading (this can be made into a static site even though we are dynamically loading data)
// https://reactrouter.com/how-to/file-route-conventions#nested-urls-without-layout-nesting (why we have te _)

import LinkList from "~/components/LinkList/LinkList";
import type { Route } from "./+types/route";
import { loadAllPostsParsed } from "~/.server/posts";
import "./musings.css";

export async function loader({ params }: Route.LoaderArgs) {
    // Load all posts. Also caches them in allPosts variable in posts.ts
    // When a post is requested individually, that cache is used by getPostByPath.
    const parsedPosts = await loadAllPostsParsed(); 
    return {parsedPosts};
}

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