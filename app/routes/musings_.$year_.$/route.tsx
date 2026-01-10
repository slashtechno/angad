import { data } from "react-router";
import type { Route } from "./+types/route";
import remarkGfm from "remark-gfm";
import { getPostByRelativeHref } from "~/.server/posts";
import Markdown, { defaultUrlTransform } from "react-markdown";
import "./musing.css";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import 'highlight.js/styles/nord.css';
/**
 * Load a musing post identified by the route's year and splat parameters.
 *
 * Constructs a relative path from `params.year` and `params["*"]`, fetches the post,
 * and throws a 404 DataResponse if no post is found.
 *
 * @returns The post object for the requested musing.
 * @throws A 404 DataResponse when the requested post does not exist.
 */

export async function loader({ params }: Route.LoaderArgs) {
  // MusingYearIdRoute loader called with params: { year: '2026', '*': 'test/loading/helloworld' }
  const { year, "*": splat } = params;

  //   Get the post
  const post = await getPostByRelativeHref(`/musings/${year}/${splat}`);
  // Check if it was found and if not, 404
  // https://reactrouter.com/how-to/error-boundary#3-throw-data-in-loadersactions
  if (!post) {
    throw data("Post Not Found", { status: 404 });
  }
  return post;
}

/**
 * Render a musing page for a post provided by the route loader.
 *
 * Renders the document title and meta description, a header with the post's
 * frontmatter (title and date) and category, and the post body as Markdown
 * (GFM and syntax highlighting enabled). If `loaderData` is missing, renders
 * a simple "Post not found." fallback.
 *
 * @param loaderData - The post object returned by the route loader, expected to
 *   include `frontmatter` (title, date), `category`, and `markdownContent`.
 * @returns A React element containing the musing page.
 */
export default function MusingYearIdRoute({
  loaderData,
}: Route.ComponentProps) {
  const post = loaderData;

  if (!post) {
    return <div>Post not found.</div>;
    // This should not be reachable because of the loader's 404 handling
  }
  return (
    <div className="musing-container">
      {/* We need a template string since otheriwse, it doesn't work and the following is errored: "React expects the `children` prop of <title> tags to be a string, number, bigint, or object with a novel `toString` method but found an Array with length 2 instead." */}
      <title>{`${post?.frontmatter.title} - Angad Behl`}</title>
      {/* <meta name="description" content="{post?.frontmatter.title}" />  */}
      <meta
        name="description"
        content={`"${post?.frontmatter.title}", a musing by Angad Behl.`}
      />
      <div className="info">
        <h2>{post?.frontmatter.title}</h2>
        <p>
          <em>{post?.frontmatter.date}</em>
        </p>
        <p>
          Category: <em>{post?.category}</em>
        </p>
      </div>
      {/* https://github.com/remarkjs/react-markdown?tab=readme-ov-file#use-a-plugin */}
      {/* https://github.com/remarkjs/react-markdown?tab=readme-ov-file#appendix-b-components */}
      {/* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions */}
      <Markdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }]]} rehypePlugins={[rehypeRaw, [rehypeHighlight, {
        }]]} urlTransform={(url) => {
          // don't worry about file://, but otherwise, pass through the default transformer
          if (url.startsWith("file://")) {
            return url;
          } else {
            return defaultUrlTransform(url);
          }
        }}
      >
        {post?.markdownContent}
      </Markdown>
    </div>
  );
}