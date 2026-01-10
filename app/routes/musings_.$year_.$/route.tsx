import { data } from "react-router";
import type { Route } from "./+types/route";
import remarkGfm from "remark-gfm";
import { getPostByRelativeHref } from "~/.server/posts";
import Markdown from "react-markdown";
import "./musing.css";
// https://reactrouter.com/start/framework/data-loading#static-data-loading

export async function loader({ params }: Route.LoaderArgs) {
  console.debug("MusingYearIdRoute loader called with params:", params);
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

export default function MusingYearIdRoute({
  loaderData,
}: Route.ComponentProps) {
  const post = loaderData;

  if (!post) {
    return <div>Post not found.</div>;
    // This should not be reachable because of the loader's 404 handling
  }
  console.debug(post?.frontmatter.title);
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
        <p>Category: <em>{post?.category}</em></p>
      </div>
      {/* https://github.com/remarkjs/react-markdown?tab=readme-ov-file#use-a-plugin */}
      <Markdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>
        {post?.markdownContent}
      </Markdown>
    </div>
  );
}
