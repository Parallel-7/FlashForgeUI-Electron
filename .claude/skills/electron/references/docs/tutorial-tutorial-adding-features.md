# Source: https://www.electronjs.org/docs/latest/tutorial/tutorial-adding-features

On this page

Follow along the tutorial

This is **part 4** of the Electron tutorial.

1. [Prerequisites](/docs/latest/tutorial/tutorial-prerequisites)
2. [Building your First App](/docs/latest/tutorial/tutorial-first-app)
3. [Using Preload Scripts](/docs/latest/tutorial/tutorial-preload)
4. **[Adding Features](/docs/latest/tutorial/tutorial-adding-features)**
5. [Packaging Your Application](/docs/latest/tutorial/tutorial-packaging)
6. [Publishing and Updating](/docs/latest/tutorial/tutorial-publishing-updating)

## Adding application complexity[â](#adding-application-complexity "Direct link to Adding application complexity")

If you have been following along, you should have a functional Electron application
with a static user interface. From this starting point, you can generally progress
in developing your app in two broad directions:

1. Adding complexity to your renderer process' web app code
2. Deeper integrations with the operating system and Node.js

It is important to understand the distinction between these two broad concepts. For the
first point, Electron-specific resources are not necessary. Building a pretty to-do
list in Electron is just pointing your Electron BrowserWindow to a pretty
to-do list web app. Ultimately, you are building your renderer's UI using the same tools
(HTML, CSS, JavaScript) that you would on the web. Therefore, Electron's docs will
not go in-depth on how to use standard web tools.

On the other hand, Electron also provides a rich set of tools that allow
you to integrate with the desktop environment, from creating tray icons to adding
global shortcuts to displaying native menus. It also gives you all the power of a
Node.js environment in the main process. This set of capabilities separates
Electron applications from running a website in a browser tab, and are the
focus of Electron's documentation.

## How-to examples[â](#how-to-examples "Direct link to How-to examples")

Electron's documentation has many tutorials to help you with more advanced topics
and deeper operating system integrations. To get started, check out the
[How-To Examples](/docs/latest/tutorial/examples) doc.

Let us know if something is missing!

If you can't find what you are looking for, please let us know on [GitHub](https://github.com/electron/website/issues/new) or in
our [Discord server](https://discord.gg/electronjs)!

## What's next?[â](#whats-next "Direct link to What's next?")

For the rest of the tutorial, we will be shifting away from application code
and giving you a look at how you can get your app from your developer machine
into end users' hands.

* [Adding application complexity](#adding-application-complexity)* [How-to examples](#how-to-examples)* [What's next?](#whats-next)