---
title: Rewriting Cross Blogger
date: 2024-06-29
lastmod: 2024-06-29
draft: false
tags: ["python"]
categories: ["projects"]
description: Rewriting Cross Blogger - a headless CMS for static sites
---
{{< collapseRawHtml summary="Video demonstration" >}}
{{<youtube H3HyQ7h5ogE>}}
{{< /collapseRawHtml >}}
## Background
Nearly two years ago, in August of 2022, I began work on [Cross Blogger](https://github.com/slashtechno/cross-blogger). Cross Blogger was my first Go project. Originally, I used it as an opportunity to learn about APIs and hoped that I might eventually be able to make it useful. At the beginning of 2023, I stopped working on it, however. I moved on to other programs and stopped using Go. I left it in a state where the program was usable, albeit useless.
When I was first learning Go, I had not realized how important splitting code up into a multi-file structure is. Thus, the project's code was contained in a single `main.go` file. Eventually, I realized that building projects with large file-structures is simple and makes programming *significantly* easier. This provided me with some motivation to come back to the project. It also gave me a project to do for Hack Club's Arcade Hour.

## The process of ~~refactoring~~ rewriting the codebase
After a significant hiatus, I chose to refactor the project in June of 2024. I started by making a change I had aimed to make in the early stages of development - switching to [Cobra](https://github.com/spf13/cobra). Cobra is a framework for building CLI applications but due to my initial confusion regarding multi-file packages, I didn't end up migrating to this. When I came back to it, I created a directory titled `cobra` and started fresh.
I ended up rewriting most of the codebase with various optimizations. I also implemented an OAuth flow wherein a web server is used. In the past, I had a simple webpage hosted on Netlify that showed the query parameter passed by the OAuth callback and instructed the user to paste it in the terminal where the program was running. Either way, it felt slightly more seamless with the new implementation. The new codebase used a standard, multi-package Go structure. Whenever I noticed source file becoming hard to scroll through, I split it up. As variables are shared within the same package (without needing to be exported), this led to much better readability with minimal work.
On a site note, LLMs can be used to generate a description from the Blogger post as the API doesn't return one. Both Ollama and any OpenAI-compatible API should work.
### The transition to a headless CMS
Google has, at the time of writing, a service called [Blogger](https://blogger.com/). Blogger has a simple interface for publishing blog posts and some nice themes built-in. However, I like Hugo significantly better. Hugo is extremely customizable, open source, and there are no limitations regarding where its output files can be hosted.
Cross Blogger, from the beginning, supported Blogger (hence the name). However, it was cumbersome to use and wasn't automated. I wanted to prevent unnecessary complexity when watching Blogger for new posts. The simplest way to do this, I decided, was to fetch the published posts on an interval and compare against the list of known posts and posting the new posts to the specified destination(s). As I imagine re-publishing the entire blog isn't optimal, it ignore the posts that were published before running the program. However, these posts can still be published manually. Implementing this also gave me an opportunity to learn more about Goroutines.

#### Git integration
Often, a static site will be stored in a Git repository. This not only allows for version control, but also for contributions. Having the code be open source also means someone can reference your configuration. One of the most powerful parts, however, is continuous deployment.
Adding support for pushing to Git was relatively simple and works rather well. When a new post is written to the content directory, a commit can be made with the inherited Git settings and pushed the configured remote.
##### Deployment
<!-- Link to Wayback machine if the article no longer exists: https://web.archive.org/web/20240625155702/https://codebenchers.com/blog/gitea-actions-vercel -->
Services like Vercel and Netlify can use the files from a Git repository to build a site, and deploy it seamlessly. Generally, it's extremely simple to automatically perform these actions when a commit is pushed if you link to a GitHub or GitLab repository. If you're using Cloudflare, Cloudflare Pages may also be worth looking into.
However, in some cases, you may want to use a service like Gitea. At least when I tried this, Vercel did not offer automatic deployment from self-hosted Git repositories on the hobby plan. Vercel does, however, offer a CLI. After configuring Gitea Actions, I followed [this](https://codebenchers.com/blog/gitea-actions-vercel) guide to setup a workflow that automatically deploys to Vercel. This shouldn't be needed if you're running on GitHub or GitLab.
Git integration combined with continuous deployment allows for changes made in Blogger to be quickly reflected on the site.

#### Post deletion
One feature that I wanted to implement was the ability to delete posts if they were deleted or unpublished in Blogger. This, however, would lead to posts that existed before Cross Blogger started being used to also be deleted. Initially, I started implementing an external database, something I've recently done in Python but not in Go.
Fortunately, I realized how bad of an idea this would have been before I got too far. As the primary purpose is to produce Markdown files ready for a headless CMS, I had already implemented frontmatter support. By simply adding a key, called `managedByCrossBlogger` at the time of writing, posts created by Cross Blogger can easily be tracked. As this is in the file itself, no database is needed! Hugo also should ignore this meaning it should have no impact on the final site.

## Cross compatibility and frontmatter
Frontmatter mappings are customizable. This allows for the keys that certain frontmatter values are mapped to to be changed or disabled. This opens the door for compatibility with static site generators other than Hugo, in addition to making the output more customizable.

## Closing remarks
I'm not sure if I'm going to continue developing Cross Blogger. I'm not even using it to write this post - I'm using VS Code! However, I believe it does have potential. I may make some changes such trying to allow catagories to be set and persistent frontmatter options.
I've enjoyed building Cross Blogger and I've thought of ideas for a couple other projects with a similar concept in mind. I think I'll be able to execute an idea such as this better when I start writing full-stack applications. I'm not sure if a command line tool is the best option for a tool like this.
Cross Blogger is definitely a project I'm proud of. It's come a long way since original ~500 line `main.go` file and it can feasibly be used in production if needed. If I do continue development, adding support for other blogging platforms, not just Blogger, might be a nice improvement.
