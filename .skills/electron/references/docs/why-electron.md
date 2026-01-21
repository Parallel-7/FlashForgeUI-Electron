# Source: https://www.electronjs.org/docs/latest/why-electron

On this page

Electron is a framework enabling developers to build cross-platform desktop applications for macOS, Windows, and Linux by combining web technologies (HTML, JavaScript, CSS) with Node.js and native code. It is open-source, MIT-licensed, and free for both commercial and personal use. In this document, weâll explain why companies and developers choose Electron.

We can split up the benefits of Electron in two questions: First, why should you use web technologies to build your application? Then, why should you choose Electron as the framework to do so?

If youâre already using web technologies for your application, you can skip straight to the `Why Electron?` section below.

## Why choose web technologies[â](#why-choose-web-technologies "Direct link to Why choose web technologies")

Web technologies include HTML, CSS, JavaScript, and WebAssembly. Theyâre the storefront of the modern Internet. Those technologies have emerged as the best choice for building user interfaces â both for consumer applications as well as mission-critical business applications. This is true both for applications that need to run in a browser as well as desktop applications that are not accessible from a browser. Our bold claim here is that this isnât just true for cross-platform applications that need to run on multiple operating systems but true overall.

As an example, NASAâs actual [Mission Control](https://github.com/nasa/openmct) is written with web technologies. The [Bloomberg Terminal](https://en.wikipedia.org/wiki/Bloomberg_Terminal), the computer system found at every financial institution, is written with web technologies and runs inside Chromium. It costs $25,000 per user, per year. The McDonaldâs ordering kiosk, powering the worldâs biggest food retailer, is entirely built with Chromium. The [SpaceXâs Dragon 2 space capsule](https://old.reddit.com/r/spacex/comments/gxb7j1/we_are_the_spacex_software_team_ask_us_anything/ft62781/?context=3) uses Chromium to display its interface. You get the point: web technologies are a great tech stack to build user interfaces.

Here are the reasons we, the Electron maintainers, are betting on the web.

### Versatility[â](#versatility "Direct link to Versatility")

Modern versions of HTML and CSS enable your developers and designers to fully express themselves. The webâs showcase includes Google Earth, Netflix, Spotify, Gmail, Facebook, Airbnb, or GitHub. Whatever interface your application needs, you will be able to express it with HTML, CSS, and JavaScript.

If you want to focus on building a great product without figuring out how you can realize your designerâs vision in a specific UI framework, the web is a safe bet.

### Reliability[â](#reliability "Direct link to Reliability")

Web technologies are the most-used foundation for user interfaces on the planet. They have been hardened accordingly. Modern computers have been optimized from the CPU to the operating system to be good at running web technologies. The manufacturers of your userâs devicesâbe that an Android phone or the latest MacBookâwill ensure that they can visit websites, play videos on YouTube, or display emails. In turn, theyâll also ensure that your app has a stable foundation, even if you have just one user.

If you want to focus on building a great product without debugging a weird quirk that nobody has found before, the web is a safe bet.

### Interoperability[â](#interoperability "Direct link to Interoperability")

Whatever provider or customer data you need to interact with, they will have probably thought of an integration path with the web. Depending on your technology choice, embedding a YouTube video either takes 30 seconds or requires you to hire a team devoted to streaming and hardware-accelerated video decoding. In the case of YouTube, using anything other than the provided players is actually against their terms and conditions, so youâll likely embed a browser frame before you implement your own video streaming decoder.

There will be virtually no platform where your app cannot run if you build it with web technologies. Virtually all devices with a displayâbe that an ATM, a car infotainment system, a smart TV, a fridge, or a Nintendo Switchâcome with means to display web technologies. The web is safe bet if you want to be cross-platform.

### Ubiquity[â](#ubiquity "Direct link to Ubiquity")

Itâs easy to find developers with experience building with web technologies. If youâre a developer, itâll be easy to find answers to your questions on Google, Stack Overflow, GitHub, or a coding AI of your choice. Whatever problem you need to solve, itâs likely that somebody has solved it well beforeâand that you can find the answer to the puzzle online.

If you want to focus on building a great product with ample access to resources and materials, the web is a safe bet.

## Why choose Electron[â](#why-choose-electron "Direct link to Why choose Electron")

Electron combines Chromium, Node.js, and the ability to write custom native code into one framework for building powerful desktop applications. There are three main reasons to use Electron:

### Enterprise-grade[â](#enterprise-grade "Direct link to Enterprise-grade")

Electron is reliable, secure, stable, and mature. It is the premier choice for companies building their flagship product. We have a list of some of those companies on our homepage, but just among chat apps, Slack, Discord, and Signal are built with Electron. Among AI applications, both OpenAIâs ChatGPT and Anthropicâs Claude use Electron. Visual Studio Code, Loom, Canva, Notion, Docker, and countless other leading developers of software bet on Electron.

We did make it a priority to make Electron easy to work with and a delight for developers. Thatâs likely the main reason why Electron became as popular as it is today â but what keeps Electron alive and thriving is the maintainerâs focus on making Electron as stable, secure, performant, and capable of mission-critical use cases for end users as possible. Weâre building an Electron that is ready to be used in scenarios where unfixable bugs, unpatched security holes, and outages of any kind are worst-case scenarios.

### Mature[â](#mature "Direct link to Mature")

Our current estimation is that most desktop computers on the planet run at least one Electron app. Electron has grown by prioritizing talent in its maintainer group, fostering excellent and sustainable engineering practices in managing the ongoing maintenance, and proactively inviting companies betting on Electron to directly contribute to the project. Weâre an impact project with the OpenJS foundation, which is itself a part of the Linux foundation. We share resources and expertise with other foundation projects like Node.js, ESLint, Webpack - or the Linux Kernel or Kubernetes.

What does all of that mean for you, a developer, in practice?

* **Reliable release schedule**: Electron will release a new major version in lockstep with every second major Chromium release, usually on the same day as Chromium. A lot of work, both in the form of building processes and tools, but also in terms of raw invested hours every week, has to go into making that happen.
* **No dictators**: Sometimes, betting on a technology also requires you to bet on a single person or company. In turn, it requires you to trust that the person or company never has a breakdown, starts fighting you directly, or does anything else drastic thatâll force you rethink your entire tech stack. Electron is maintained by a diverse set of companies (Microsoft, Slack/Salesforce, Notion, and more) and will continue to welcome more companies interested in ensuring their âseat at the decision-making tableâ.

### Stability, security, performance[â](#stability-security-performance "Direct link to Stability, security, performance")

Electron delivers the best experience on all target platforms (macOS, Windows, Linux) by bundling the latest version of Chromium, V8, and Node.js directly with the application binary. When it comes to running and rendering web content with upmost stability, security, and performance, we currently believe that stack to be âbest in classâ.

#### Why bundle anything at all[â](#why-bundle-anything-at-all "Direct link to Why bundle anything at all")

You might wonder why we bundle Chromiumâs web stack with our apps when most modern operating systems already ship a browser and some form of web view. Bundling doesnât just increase the amount of work for Electron maintainers dramatically, it also increases the total disk size of Electron apps (most apps are >100MB). Many Electron maintainers once developed applications that did make use of embedded web views â and have since accepted the increased disk size and maintainer work as a worthy trade-off.

When using an operating system's built-in web view, you're limited by the browser version included in the oldest operating system version you need to support. We have found the following problems with this approach:

* **Stability**: The modern web technology stack is complex, and as a result, youâll sooner or later encounter bugs. If you use the operating systemâs web view, your only recourse will be to ask your customers to upgrade their operating system. If no upgrade is available for that machine (because of no ability to upgrade to the latest macOS or Windows 11), youâll have to ask them to buy a new computer. If youâre unlucky, youâre now losing a major customer because they will not upgrade their entire fleet of thousands of machines just because one team wanted to try your startupâs app. You have *no recourse* in this situation. Even the risk of that happening is unacceptable to the companies that employ the Electron maintainers.
* **Security:** Similar to how you can fix stability bugs by releasing an app update, you can also release security fixes to your application without asking your customer to upgrade their operating system. Even if operating system providers prioritize updates to their built-in browser, we have not seen them reliably update the built-in web views with similar urgency. Bundling a web renderer gives you, the developer, control.
* **Performance:** For simple HTML documents, a built-in web view will sometimes use fewer resources than an app with a bundled framework. For bigger apps, it is our experience that we can deliver better performance with the latest version of Chromium than we can with built-in web views. You might think that the built-in view can share a lot of resources with other apps and the operating systemâ but for security reasons, apps have to run in their own sandboxes, isolated from each other. At that point, the question is whether the OSâ web view is more performant than Chromium. Across many apps, our experience is that bundling Chromium and Node.js enables us to build better and more performant experiences.

#### Why bundle Chromium and Node.js[â](#why-bundle-chromium-and-nodejs "Direct link to Why bundle Chromium and Node.js")

Electron aims to enable the apps it supports to deliver the best possible user experience, followed by the best possible developer experience. Chromium is currently the best cross-platform rendering stack available. Node.js uses Chromiumâs JavaScript engine V8, allowing us to combine the powers of both.

* **Native code when you want it**: Thanks to Node.jsâ mature native addon system, you can always write native code. There is no system API out of reach for you. Whatever macOS, Windows, or Linux feature youâll want to integrate with âas long as you can do it in C, C++, Objective-C, Rust, or another native language, youâll be able to do it in Electron. Again, this gives you, the developer, maximum control. With Electron, you can use web technologies without choosing *only* web technologies.

### Developer experience[â](#developer-experience "Direct link to Developer experience")

To summarize, we aim to build an Electron that is mature, enterprise-grade, and ready for mission-critical applications. We prioritize reliability, stability, security, and performance. That said, you might also choose Electron for its developer experience:

* **Powerful ecosystem**: Anything you find on npm will run inside Electron. Any resource available to you about how to work with Node.js also applies to Electron. In addition, Electron itself has a [thriving ecosystem](https://www.npmjs.com/search?q=electron) â including plenty of choices for installers, updaters, deeper operating system-integration, and more.
* **Plenty of built-in capabilities:** Over the last ten years, Electronâs core has gained plenty of native capabilities that you might need to build your application. Written in C++ and Objective-C, Electron has [dozens of easy-to-use APIs for deeper operating-system integration](https://www.electronjs.org/docs/latest/api/app) â like advanced window customization for transparent or oddly shaped widgets, receiving push notifications from the Apple Push Notification Network, or handling a custom URL protocol for your app.
* **Open source**: The entire stack is open source and open to your inspection. This ensures your freedom to add any feature or fix any bug you might encounter in the future.
* **Native code when you need it:** It bears repeating that Electron allows you to mix and match web technologies and C++, C, Objective-C, Rust, and other native languages. Whether it be SQLite, a whole LLM, or just the ability to call one specific native API, Electron will make it easy.

---

## Why choose something else[â](#why-choose-something-else "Direct link to Why choose something else")

As outlined above, the web is an amazing platform for building interfaces. That doesnât mean that we, the maintainers, would build *everything* with HTML and CSS. Here are some notable exceptions:

**Resource-Constrained Environments and IoT:** In scenarios with very limited memory or processing power (say, one megabyte of memory and 100MHz of processing power on a low-powered ARM Cortex-M), you will likely need to use a low-level language to directly talk to the display to output basic text and images. Even on slightly higher-powered single-chip devices you might want to consider an embedded UI framework. A classic example is a smart watch.

**Small Disk Footprint**: Zipped Electron apps are usually around 80 to 100 Megabytes. If a smaller disk footprint is a hard requirement, youâll have to use something else.

**Operating System UI Frameworks and Libraries**: By allowing you to write native code, Electron can do anything a native application can do, including the use of the operating systemâs UI components, like WinUI, SwiftUI, or AppKit. In practice, most Electron apps make rare use of that ability. If you want the majority of your app to be built with operating system-provided interface components, youâll likely be better off building fully native apps for each operating system youâd like to target. Itâs not that itâs impossible with Electron, itâll just likely be an overall easier development process.

**Games and Real-Time Graphics:** If you're building a high-performance game or application requiring complex real-time 3D graphics, native frameworks like Unity, Unreal Engine, or DirectX/OpenGL will provide better performance and more direct access to graphics hardware. Web fans might point out caveats, like the fact that even Unreal Engine ships with Chromium â or that WebGPU and WebGL are developing rapidly and many game engines, including the ones listed here, can now output their games in a format that runs in a browser. That said, if you asked us to build the next AAA game, weâd likely use something else than just web technologies.

**Embedding Lightweight Websites**: Electron apps typically are mostly web apps with native code sprinkled in where useful. Processing-heavy Electron applications tend to write the UI in HTML/CSS and build the backend in Rust, C++, or another native language. If youâre planning to build a primarily native application that also wants to display a little website in a specific view, you might be better off using the OS-provided web view or something like [ultralight](https://ultralig.ht/).

* [Why choose web technologies](#why-choose-web-technologies)
+ [Versatility](#versatility)+ [Reliability](#reliability)+ [Interoperability](#interoperability)+ [Ubiquity](#ubiquity)* [Why choose Electron](#why-choose-electron)
+ [Enterprise-grade](#enterprise-grade)+ [Mature](#mature)+ [Stability, security, performance](#stability-security-performance)
- [Why bundle anything at all](#why-bundle-anything-at-all)- [Why bundle Chromium and Node.js](#why-bundle-chromium-and-nodejs)+ [Developer experience](#developer-experience)* [Why choose something else](#why-choose-something-else)