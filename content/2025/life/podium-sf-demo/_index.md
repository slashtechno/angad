---
title: "Testing Podium @ MakerHacks in S.F."
date: "2025-02-15"
summary: "I flew out to San Francisco to demo Podium, a peer-judging platform I'm building at Hack Club. While it worked reasonably well, I was able to observe some UX issues that I plan to address."
---
Last weekend, I had the opportunity to go to [MakerHacks](https://www.makerhacks.org/) in San Francisco, California to test a project I’ve been working on for the past three months while contracting at Hack Club: [Podium](https://podium.hackclub.com), a peer-judging platform built for hackathons. 

## Background and philosophy

Traditionally, the winners of a hackathon have been determined by judges who occasionally are industry professionals. This leads to a monotonous, grindy environment. The fun, collaborative aspects of hackathons, and programming in general, are replaced by a drive to appease a small pool of judges by predicting their opinions. In the case of high-school hackathons, this change in mentality can turn what could otherwise be an introduction to the wonderful world of making into an off-putting, competitive mess. 

Peer judging, on the other hand, creates an environment wherein hackathon participants focus on creating the types of projects their **friends** would use, rather than an industry professional. In practice, this means not expecting someone to solve world-hunger in twenty-four hours but rather, get into the mindset of making. Just as no artist begins painting with the sole intention of getting their first piece into the Louvre, a low-pressure, peer-judged hackathon can allow for individuals to discover the joy of making while still maintaining competitiveness and creativity.

## Building Podium

Prior to developing Podium, I had only worked on small-scale personal projects. Knowing from the start that in a matter of months, my code would be deployed in 100+ cities globally was exciting as much as it was a challenge. I was given a list of requirements and given nearly total creative freedom as to how to accomplish them. 

I chose FastAPI for the backend as I’ve been using Python since I was in elementary school and it’s a well-documented and well-developed library. For the frontend, I chose SvelteKit since that was the framework I was most familiar with. Airtable was used for the database, similar to the majority of Hack Club applications. 

### Validation

The phrase “[never trust the client](https://news.ycombinator.com/item?id=11583820)” is one that has been muttered by countless game developers, and frankly all developers, over the years. In the case of a peer-judging platform, this philosophy is paramount in ensuring votes are unable to be manipulated. This took shape in the form of a lot of backend validation to prevent users from voting multiple times, voting for their own projects, or outright erasing the votes of other projects. In addition to maintaining competitive integrity, Pydantic made type safety seamless.

### Integrating the API

As the backend codebase grew, so did the complexity of adding new functionality to the frontend. Therefore, I made the decision to automatically generate an SDK with [openapi-ts](https://github.com/hey-api/openapi-ts). In tandem with backend validation via Pydantic, using openapi-ts allowed for type-checking and efficient error handling in the frontend.

### UI

I’m not a UX designer and frankly, I wasn't quite sure the best way to style the UI. After initially using LLM-generated Tailwind snippets to make Podium look usable while I worked on the core functionality, I tried out [DaisyUI](https://daisyui.com/), a Tailwind component library that allowed me to turn a prototype into something I myself would use. DaisyUI also provided for easy theming allowing Podium to respect system preferences for dark/light mode by default and allowing the user to select more unique themes with a simple menu. 

## MakerHacks

### Initial reception 

MakerHacks organizers appeared to be extremely enthusiastic regarding adopting Podium mere days prior the event. Upon arriving at the event, I sat down with the organizers and learned they planned to replace one of three judge-appointed winners with a winner chosen via Podium. After the organizers set up MakerHacks on Podium, they suggested I move project creation to the projects page from the main dashboard. 

### Improvements

Being at a hackathon, I naturally had ample time to work on Podium prior to it being presented to attendees the next day. In addition to reorganizing the dashboard/page structure, I tried to mimic the positive UX elements seen in other apps. Instead of a plain *401 Unauthorized* error, I added a prompt to login that would redirect users to the page they were trying to access, proceeding a successful login. Rather than requiring users to input a code manually to collaborate on a project or join an event, I added invite links. These improvements would culminate in the first alpha test in a matter of hours. 

### Real-world usage and feedback

Observing an entire room of people experiencing my code was surreal. Nonetheless, I noticed a couple issues. The most simple, yet common, was only allowing two-character country codes and presenting an error that was too cryptic if the user entered something other than that. The solution? Using a simple dropdown, which I mistakenly overlooked when adding the address fields. The most widespread issue was one of UX design wherein many users didn’t understand how to get to the project dashboard to submit a project after joining the event. Based on my observations and the feedback I received, the solution I’m currently leaning towards is adding two badges in the header linking to both the projects dashboard and the events dashboard. In addition, an attendee suggested to me that I add some sort of notification to tell a user who has joined an event suggesting that they go to the projects dashboard and submit their project. 

Creating a QR code for the link used to join MakerHacks on Podium initially seemed to work great, but I noticed that users weren’t auto-joining the event after sign up. This was due to the redirect parameter in the login URL not containing query parameters from the page the user was initially trying to access, meaning most users had to enter in the event’s join code manually.

## Looking ahead

Podium proved to be rather usable, allowing for MakerHacks to have another set of three winners for their open prototype competition solely determined with Podium. Even with the UX-issues, **sixty-six** users joined Podium at MakerHacks. After the UX is improved, I’m looking forward to further developing Podium into an all-in-one solution for running hackathons.