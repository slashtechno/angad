import { dir } from "console";
import dayjs from "dayjs";
import { access, constants } from "fs/promises";
import matter from "gray-matter";
import type { Root } from "node_modules/remark-parse/lib";
import type { Node } from "node_modules/unified/lib";
import path, { isAbsolute, join, resolve } from "path";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import plugin from "vite-plugin-devtools-json";

export interface PostRaw {
  path: string;
  rawContent: string;
}

export interface PostFrontmatter {
  title: string;
  date: string;
  // draft is optional in the frontmatter; the parser will default it to false when absent
  draft?: boolean;
}

export interface Post {
  relativeHref: string; // /musings/<year>/[category]/[sub-category]/[...]/<slug> (categories may be omitted to be just /musings/<year>/<slug>; notice the lack of the _index.md and content/)
  slug: string; // directory that _index.md is in
  markdownContent: string; // Will be rendered with react-markdown
  frontmatter: PostFrontmatter;
  category: string; // If the path is /content/2025/life/photography/my-new-camera/_index.md, category is `life/photography`
  postDir: string; // Directory where the _index.md is located, e.g. /content/2025/life/photography/my-new-camera
}

// Not too worried about global state, especially since we prerender
export let allPosts: Post[] = [];

export async function loadAllPostsParsed(): Promise<Post[]> {
  const posts = import.meta.glob(`/content/**/_index.md`, {
    eager: true,
    query: "?raw",
    import: "default",
  }) as Record<string, string>;
  // Transform the posts object into an array of PostRaw
  const rawPosts = Object.entries(posts).map(([path, rawContent]) => ({
    path, // Looks like /content/2026/test/loading/helloworld/_index.md
    rawContent,
  }));

  //  separate the frontmatter and the content
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
  const parsedPosts = await Promise.all(rawPosts.map(parsePostRaw));

  // Filter out drafts
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
  const nonDraftPosts = parsedPosts.filter(
    (post) => post.frontmatter.draft === false
  );

  // https://www.geeksforgeeks.org/javascript/sort-an-object-array-by-date-in-javascript/
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#sorting_array_of_objects
  nonDraftPosts.sort(
    (a, b) =>
    {
      // If a negative number is returned, a is sorted before b
      // A later date will have a greater timestamp, so `b - a` will sort in descending order
      return new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime();
    }
  )

  allPosts = nonDraftPosts;
  // console.log(
  //   "Loaded and parsed all posts, setting allPosts variable: ",
  //   allPosts
  // );
  return nonDraftPosts;
}

async function parsePostRaw(postRaw: PostRaw): Promise<Post> {
  const { data, content } = matter(postRaw.rawContent);
  // Convert the year to yyyy-mm-dd format if it's a Date object (which it most likely got automatically converted to https://github.com/jonschlinkert/gray-matter/issues/62)
  if (data.date instanceof Date) {
    // https://day.js.org/docs/en/parse/date and https://day.js.org/docs/en/display/format
    data.date = dayjs(data.date).format("YYYY-MM-DD");
  }

  // Validate required frontmatter fields
  if (!data.title || !data.date) {
    throw new Error(
      `Invalid frontmatter in ${postRaw.path}: missing title or date`
    );
  }

  if (data.draft === undefined) {
    data.draft = false;
  }

  // Get metadata from the path
  const { year, category, slug, relativeHref, postDir } =
    await parsePostPathForMetadata(postRaw.path);
  console.debug(
    `Parsed post metadata for ${postRaw.path}: year=${year}, category=${category}, slug=${slug}, relativeHref=${relativeHref}`
  );

  return {
    relativeHref: relativeHref,
    slug: slug,
    markdownContent: await rewriteRelativeImageUrls(postDir, content),
    // markdownContent: content,
    frontmatter: data as PostFrontmatter,
    category: category,
    postDir: postDir,
  };
}

export async function getPostByRelativeHref(
  relativeHref: string
): Promise<Post | null> {
  if (allPosts.length === 0) {
    console.log("allPosts is empty, loading posts to get post by path.");
    await loadAllPostsParsed();
  }
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
  // When the relativeHref matches, return that post. Otherwise, if nothing matches, return null.
  return allPosts.find((post) => post.relativeHref === relativeHref) || null;
}

async function parsePostPathForMetadata(postPath: string): Promise<{
  year: string;
  category: string;
  slug: string;
  relativeHref: string;
  postDir: string;
}> {
  // Deal with the path (https://www.w3schools.com/nodejs/nodejs_path.asp)
  /* Find content dir using find-up.
  From the find-up README:
  ```
  console.log(await findUp(async directory => {
    const hasUnicorn = await pathExists(path.join(directory, 'unicorn.png'));
    return hasUnicorn && directory;
  }, {type: 'directory'}));
  //=> '/Users/sindresorhus
  ```
  So we can look for .root
  */
  //   const contentDir = await findUp(async directory => {
  // 	const hasRoot = await pathExists(path.join(directory, '.root'));
  //   // From the README: Returns a Promise for either the path or undefined if it could not be found.
  //   // So if hasRoot is true, we need to return the directory (dir is async so it returns a promise) and if not, return undefined.
  // 	return hasRoot ? directory : undefined;
  // }, {type: 'directory'});

  let currentDir = path.dirname(postPath); // Start from the directory of the post file
  // Store the post file directory
  const postDir = currentDir;
  let dirsFound: string[] = [];
  // Run until we've either hit root or found the content dir
  while (
    (await nameContentAndHasRoot(currentDir)) === false &&
    isDirRoot(currentDir) === false
  ) {
    dirsFound.push(path.basename(currentDir));
    currentDir = path.dirname(currentDir); // Move up one directory
  }

  if (dirsFound.length === 0) {
    throw new Error(
      `Could not parse post path for metadata: ${postPath}; no directories found above content dir, something is wrong.`
    );
  }

  // Reverse dirsFound since it starts with the first dir above _index.md
  dirsFound = dirsFound.reverse();
  // Now, it should look like ["life", "photography", "my-new-camera"], so remove the last element which is _index.md's dir and make it the slug
  const slug = dirsFound.pop();
  if (!slug) {
    throw new Error(
      `Could not determine slug from post path: ${postPath}; last element in dirsFound is undefined.`
    );
  }
  // The year is the first element
  const year = dirsFound.shift();
  if (!year) {
    throw new Error(
      `Could not determine year from post path: ${postPath}; first element in dirsFound is undefined.`
    );
  }
  // The rest is category
  const categoryParts = dirsFound;
  const category = categoryParts.join("/");
  // Combine to get the relative href
  // With category: "/musings/2025/life/photography/my-new-camera"
  // Without category: "/musings/2025/hello-world"
  const relativeHref = `/musings/${year}/${category ? category + "/" : ""}${slug}`;

  return {
    year,
    category: category,
    slug,
    relativeHref: relativeHref,
    postDir: postDir,
  };
}

async function nameContentAndHasRoot(dirPath: string): Promise<boolean> {
  const dirName = path.basename(dirPath);
  if (dirName !== "content") {
    return false;
  }
  // Check if .root exists in this directory
  const rootFileExists = await fileExists(dirPath, ".root");
  return rootFileExists;
}

function isDirRoot(dirPath: string): boolean {
  //  Check if the directory is root
  const pathObj = path.parse(dirPath);
  if (pathObj.root === pathObj.dir) {
    return true;
  }
  return false;
}

export async function fileExists(
  dirPath: string,
  fileName: string
): Promise<boolean> {
  const fullPath = join(dirPath, fileName);
  try {
    await access(fullPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function rewriteRelativeImageUrls(
  postDir: string,
  markdownContent: string
): Promise<string> {
  // Not sure how the remark stuff works exactly, mostly just took from the examples and tried to adapt it to work with src attributes. See https://github.com/remarkjs/remark?tab=readme-ov-file#what-is-this
  // This complex glob import and rewrite stuff is required to be able to do `![test](test.jpg)`, but it appears `<img src="/content/2026/test/loading/helloworld/test.jpg" alt="test using file protocol"/>` might work either way.

  function pluginToModifySrc() {
    return function (tree: Root) {
      visit(tree, "image", (node: Node) => {

        
        // { "type": "image", "title": null, "url": "test.jpg", "alt": "test", "position": { "start": { "line": 3, "column": 1, "offset": 158 }, "end": { "line": 3, "column": 18, "offset": 175 } } }
        if (node.type === "image") {
          // Create intersection type with UR
          type ImageNode = Node & { url: string };
          const imageNode = node as ImageNode;
          const src = imageNode.url;
          if (
            src &&
            !src.startsWith("http://") &&
            !src.startsWith("https://") &&
            isAbsolute(src) === false
          ) {


            // const imgUrl = new URL(
            //   join(
            //   postDir.slice(1), src
            //   ),
            //   import.meta.url
            // ).href;

            const imageModules = import.meta.glob(
              `/content/**/*.{jpg,png,gif,jpeg}`,
              { eager: true, import: "default" }
            ) as Record<string, string>;
            const images = Object.keys(imageModules);
            // ['/cont  ent/2026/test/loading/helloworld/test.jpg']
            const imageUrl = images.find((imgPath) => {
              return imgPath.startsWith(postDir + "/") && imgPath.endsWith("/" + src);
            });

            // Set the new URL and then set the node to our custom image node
            imageNode.url = imageUrl!;
            node = imageNode;
            // console.log("Rewritten image node:", node);
          }
        }


      });
    };
  }

  const vFile = await unified()
    .use(remarkParse)
    .use(pluginToModifySrc)
    .use(remarkStringify)
    .process(markdownContent);

  const newContent = String(vFile);
  return newContent;
}
