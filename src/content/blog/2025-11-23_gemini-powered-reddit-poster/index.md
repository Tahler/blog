---
title: "Gemini-powered Reddit poster"
description: "A Gemini-powered Reddit bot which posts to r/NotTooLate daily."
date: "2025-11-23"
tag: "projects"
---

_I love this idea that it's never too late to reinvent yourself, so I built a Gemini-powered Reddit bot which posts to [r/NotTooLate](https://www.reddit.com/r/NotTooLate/) daily. It's slop but it was fun nonetheless._

I was itching for a side project. I had just [listened to DHH for the first time](https://youtu.be/vagyIcmIGOQ) and excitedly switched my operating system from Debian to [Omarchy](https://omarchy.org/). It was begging me to build something.

I had this tiny app idea saved for a while: enter your age and see what historical figures started something at your age. But at the same time I felt behind in LLM "context engineering" skills and Gemini was offering a generous free tier. So the idea evolved: "scrape Wikipedia for inspirational stories and post them to Reddit". The title would include the person's age at the time so you'd be able to search. Maybe other people could even contribute some from their family, neighbors, or local legends.

I built that piecemeal:

1.  I tried iterating over all Wikipedia biographies, but Gemini had a very hard time deciding that someone was NOT interesting enough.

1.  So instead of starting from Wikipedia I [asked ChatGPT](https://chatgpt.com/share/6a0e6d0b-8e48-83e8-8d2c-c912e428d9b2) for a short list of both inspiring (e.g. Alan Rickman and Colonel Sanders) and uninspiring (e.g. Jared Kushner and Sheryl Sandberg). I used them to [iterate on the prompt](https://github.com/Tahler/not-too-late/compare/0345c0cd3aff4b437744f35934fb58d2aed259a1...2bfcce167a614d6ac6f1a98bbae7174170d3e2c6). It was especially hard for the model to write tasteful stories and keep them under Reddit's 300-character limit. But results improved dramatically by providing examples, asking for a single before-and-after instead of many stories, and using the Pro model. I also tried [using Gemini to improve its own prompt](https://gemini.google.com/share/d14d0829ca11), which gave some helpful ideas.

1.  I then put some of those in a Google Sheet and wrote some code to use that as a queue and post the next row to Reddit

    <video controls muted playsinline preload="metadata" poster="/assets/sheets-to-reddit-poster.jpg" aria-label="Demo of Google Sheets rows being posted to Reddit">
      <source src="/assets/sheets-to-reddit.mp4" type="video/mp4" />
      <a href="/assets/sheets-to-reddit.mp4">Watch the demo video</a>.
    </video>

1.  I had that run daily via `crontab` on my Raspberry Pi

1.  I [had Gemini generate](https://gemini.google.com/share/e6e48bf5dda1) hundreds more people and pasted them in a new "Identified" tab, moved a few especially interesting ones to the top, then added a nightly job to parse stories from their Wikipedia pages until I exhausted my Gemini usage.

1.  I added a Telegram bot to notify me on every post and error.

That ran on the Pi for a while. But now I'm moving and have to unplug it, so I containerized it and moved to Cloud Run.

I still receive and read the Telegram notification every day. Sometimes they're great:

> After a devastating divorce, [Giancarlo Esposito](https://en.wikipedia.org/wiki/Giancarlo_Esposito#:~:text=he%20considered%20suicide) was so broke he even considered staging his own murder so his kids could get the insurance money. Instead, he kept moving forward and was cast as Gus Fring in Breaking Bad a few years later, redefining his career.

But it also occasionally posts one I immediately delete:

> After a crushing military defeat at 33, [Mao Zedong](https://en.wikipedia.org/wiki/Mao_Zedong#:~:text=military%20opportunism) was expelled by his own party. Instead of quitting, he led 1,000 survivors into the mountains, ignored party doctrine, and reinvented his revolution by building a new kind of peasant-led guerrilla army. It became his path to power.

It was a fun little project and helpful for getting to know Gemini.
