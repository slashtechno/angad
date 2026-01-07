import matter from "gray-matter";
import path from "path";

export interface PostRaw {
  path: string;
  rawContent: string;
}

export interface PostFrontmatter {
  title: string;
  date: string; // seems dates get parsed automatically, so this might not be a string (https://github.com/jonschlinkert/gray-matter/issues/62). Do some more research, and if needed, normalize it in parsePostRaw to yyyy-mm-dd string. 9
}

export interface Post {
  relativeHref: string; // /musings/2025/hello-world
  slug: string; // hello-world, probably not going to be used
  markdownContent: string; // Will be rendered with react-markdown
  frontmatter: PostFrontmatter;
}

export let allPosts: Post[] = [];

export async function loadAllPostsParsed(): Promise<
  Post[]
> {
  const posts = import.meta.glob("/content/**/*.md", {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;
  // Transform the posts object into an array of PostRaw
  const rawPosts = Object.entries(posts).map(([path, rawContent]) => ({
    path,
    rawContent,
  }));

  //   separate the frontmatter and the content
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
  const parsedPosts = await Promise.all(
    rawPosts.map(parsePostRaw)
  );

  allPosts = parsedPosts;
  console.log("Loaded and parsed all posts, setting allPosts variable: ", allPosts);
  return parsedPosts;
}

async function parsePostRaw(postRaw: PostRaw): Promise<Post> {
  const { data, content } = matter(postRaw.rawContent);

  // Validate required frontmatter fields
  if (!data.title || !data.date) {
    throw new Error(
      `Invalid frontmatter in ${postRaw.path}: missing title or date`
    );
  }

  // Deal with the path (https://www.w3schools.com/nodejs/nodejs_path.asp)
  // Slug (hello-world)
  const slug = path.basename(postRaw.path, path.extname(postRaw.path)); 
  // Relative Href
  // Get the directory (/content/<year>)
  const dirPath = path.dirname(postRaw.path);
  // Get the year
  const year = path.basename(dirPath);
  // Combine to get the relative href
  const relativeHref = `/musings/${year}/${slug}`;

return {
    relativeHref: relativeHref,
    slug: slug,
    markdownContent: content,
    frontmatter: data as PostFrontmatter,
  };
}

export async function getPostByPath(
  postPath: string
): Promise<Post | null> {
  if (allPosts.length === 0) {
    console.log("allPosts is empty, loading posts to get post by path.");
    await loadAllPostsParsed();
  }
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
  // When the relativeHref matches, return that post. Otherwise, if nothing matches, return null.
  return allPosts.find((post) => post.relativeHref === postPath) || null;
}