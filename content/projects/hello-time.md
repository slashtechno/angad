---
title: Hello, time?
date: 2024-07-13
lastmod: 2024-07-13
draft: true 
tags: ["ai"]
aliases: ["clock"]
categories: ["projects"]
description: A simple, open-source clock that displays rhymes. Inspired by the Hack Club workshops Simple Clock and JsonDB, along with the Poem/1, an "AI rhyming clock". My first full-stack project.
---
## Background
I’ve wanted to learn full-stack development, especially in JavaScript, for a while. However, I was unsure where to start. A friend of mine recommended I start with [Express.js](https://express.js). [Hack Club](https://hackclub.com/) also had a tutorial regarding Express.js, [JsonDB](https://workshops.hackclub.com/json_db/). While following this, along with the [Simple Clock](https://workshops.hackclub.com/simple_clock/) workshop, I had the idea to make a web-based clock that displays rhymes similar to the Poem/1.
## The back end  
Following the JsonDB workshop allowed me to learn about the general structure of an Express.js application. Upon completion of the tutorial, I added rate-limiting. One aspect of full-stack projects that I enjoy is being able to make API calls from the back end. Thus, users are not required to provide their own API keys. This does, however, open up the door to abuse of an API endpoint. Whilst not a perfect solution, I implemented rate-limiting (using [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)), in under 30 lines of code, to significantly reduce the chance of the API endpoint being abused. After adding rate-limiting, I implemented calls to an OpenAI-compatible API to retrieve rhymes for a given time. This wouldn't be too useful until the front-end was implemented.
## The front end  
The front end was rather simple to develop. The Simple Clock workshop showcased the process of creating a simple analog clock. It was front-end only, however. Yet, it gave me the foundation needed for adding support for fetching rhymes.
## Making it full-stack 