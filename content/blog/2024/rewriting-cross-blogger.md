---
title: Rewriting Cross Blogger
date: 2024-06-29
lastmod: 2024-06-29
draft: false
tags: ["blogging", "ai"]
categories: ["projects"]
description: Rewriting Cross Blogger - a headless CMS for static sites
---
{{< collapseRawHtml summary="Video demonstration" >}}
{{<youtube H3HyQ7h5ogE>}}
{{< /collapseRawHtml >}}
## Background  
Nearly two years ago, in August of 2022, I began work on [Cross Blogger](https://github.com/slashtechno/cross-blogger). Cross blogger was my first Go project. Originally, I used it to learn about APIs and with the hope that I might eventually be able to make it a useful. At the beginning of 2023, I stopped working on it, however. I moved on to other programs and stopped using Go. I left it in a state where the program was usable, albeit useless.  
When I was first learning Go, I had not realized how important splitting code up into a multi-file structure is. Thus, the project's code was contained in a single `main.go` file. Eventually, I realized that building projects with large file-structures is simple and makes programming *significantly* easier.  

## The process of ~~refactoring~~ rewriting the codebase
After a significant hiatus, I chose to refactor the project in June of 2024. I started by making a change I had aimed to make in the early stages of development, switching to [Cobra](https://github.com/spf13/cobra). Cobra is a framework for building CLI applications but due to my initial confusion regarding multi-file packages, I didn't end up migrating to this. When I came back to it, I created a directory titled `cobra` and started fresh.  
I ended up rewriting most of the codebase with various optimizations. I also implemented a OAuth flow wherein a web server is used. In the past, I had a simple webpage hosted on Netlify that showed the query parameter passed by the OAuth callback and instructed the user to paste it in the terminal where the program was running. Either way - it felt slightly more seamless with the new implementation. The new codebase used the standard, multi-package Go structure. Whenever I noticed source file becoming hard to scroll through, I split it up. As variables are shared within the same package (without needing to be exported), this led to much better readability with minimal work.  
## The transition to a headless CMS  
Google has, at the time of writing, a service called [Blogger](https://blogger.com/). Blogger has a simple interface for publishing blog posts and some nice themes built-in. However, I like Hugo significantly better. Hugo is customizable, open source, and there are no limitations regarding where its output files can be hosted.  
Cross Blogger, from the beginning, supported Blogger (hence the name). However, it was cumbersome to use and wasn't automated. 