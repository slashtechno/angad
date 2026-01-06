// https://vite.dev/guide/assets.html#importing-asset-as-string
// https://vite.dev/guide/features#glob-import
// https://vite.dev/guide/features#custom-queries (used with glob for raw import)
// https://reactrouter.com/start/framework/data-loading#static-data-loading (this can be made into a static site even though we are dynamically loading data)
// https://reactrouter.com/how-to/file-route-conventions#nested-urls-without-layout-nesting (why we have te _)

import LinkList from "~/components/LinkList/LinkList";
import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
  const posts = import.meta.glob("/content/**/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;
  return { posts };
}

export default function MusingsRoute({loaderData}: Route.ComponentProps) {
    const {posts} = loaderData;
    let postList: {href: string, content: string}[] = Object.entries(posts).map( ([path, content]) => {
        // The list looks like this:
        // {"href": "/content/2026/helloworld.md", "content": "---\ntitle: Hello, world!\ndate: 2026-01-05\n---\nFor a long time, my personal site was built with Hugo and a pre-built theme. It looked fine, but I wanted to learn more about React and CSS, so I made this!"}
        return {href: path, content: content};
    })

    console.log(postList)
    
return (
    <div>
        <h1>Musings</h1>

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