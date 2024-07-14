---
title: Hello, time?
date: 2024-07-13
lastmod: 2024-07-13
cover:
    image: "hello-time-screenshot_time-08-48.png"
    relative: true
    alt: Screenshot showing the clock displaying the time and stating "Daybreak's glow, the hour does show, forty-eight minutes past eight."
draft: true 
tags: ["ai"]
aliases: ["clock"]
categories: ["projects"]
description: A simple, open-source clock that displays rhymes. Inspired by the Hack Club workshops Simple Clock and JsonDB, along with the Poem/1, an "AI rhyming clock"  
---
### TL;DR  
My first full-stack app - a clock that displays LLM-generated rhymes/poems in addition to a normal analog clock. Check it out at [clock.angad.me](https://clock.angad.me).  
## Background
I’ve wanted to learn full-stack development with JavaScript for a while. I kept putting it off, however, as I was unsure where to start. A friend of mine recommended I start with [Express.js](https://express.js) and [Hack Club](https://hackclub.com/) also had a workshop regarding Express.js, [JsonDB](https://workshops.hackclub.com/json_db/). While following this, along with the [Simple Clock](https://workshops.hackclub.com/simple_clock/) workshop, I had the idea to make a web-based clock that displays rhymes similar to the [Poem/1](https://www.kickstarter.com/projects/genmon/poem-1-the-ai-poetry-clock). For some background, the Poem/1 is a clock that displays the current time as an LLM-generated poem or short rhyme.  
In the beginning, I imagined the project wouldn't be too complex as there only needs to be a single endpoint to request a rhyme. 
## The back end  
Following the JsonDB workshop allowed me to learn about the general structure of an Express.js application. Upon completion of the tutorial, I added rate-limiting. One aspect of full-stack projects that I enjoy is being able to make API calls from the back end. Thus, users are not required to provide their own API keys. This does, however, open up the door to abuse of an API endpoint. Whilst not a perfect solution, I implemented rate-limiting using [express-rate-limit](https://www.npmjs.com/package/express-rate-limit). After adding rate-limiting, I was able to implement calls to an OpenAI-compatible API to retrieve rhymes for a given time while minimizing the chance of abuse of the API. 
To actually generate the rhymes, I had to iterate upon the prompt I was using, but I eventually started seeing consistent, clear responses. The only thing left was to pass the responses to the client making this a full-stack project.
## The front end  
The front end was rather simple to develop. The Simple Clock workshop showcased the process of creating a simple analog clock. It was a front-end only project, but it gave me the foundation needed for adding support for fetching rhymes.
## Making it full-stack  
Fetching the rhymes from the back end wasn't too complex. Essentially, all I needed to do was fetch a new rhyme every minute or when the page was loaded. 
To fetch a rhyme every minute, I initially checked if the second count was `0`. One slightly humorous issue that this caused was extreme numbers of API calls per minute, theoretically 60 due to `requestAnimationFrame` being used. To make it worse, I wasn't adding the rate-limiting middleware at the correct point in the code meaning that I was sending these requests to the OpenRouter API. Surprisingly, I didn't encounter the limit that OpenRouter imposes on the complimentary models.  
### A disclaimer  
During development, I wanted to implement a disclaimer that states that the requests to the clock may be rate-limited. Initially, I wanted to do this by comparing the hash of the set API key to the hash of my API key and if they matched, state that there may be rate-limited. I quickly realized how inefficient this would because of two main reasons: firstly, the server would need to send the hash of the API key anyway, which adds unnecessary complexity; and secondly, it makes the message hard-coded and applicable to only a single API key. Thus, I did what I probably should have implemented initially: a simple call to the back end to fetch a configurable message.  

## Real-world usability  
I was genuinely surprised how nice the project functioned, being my first full-stack project. Since it's a webpage, it can be displayed as a live wallpaper or theoretically, on an e-reader.  
I also containerized it to ease deployment. As it's compatible with any OpenAI-compatible API, it can be used with local models through something like [Ollama](https://ollama.com/).