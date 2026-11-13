# Narration: the page build gate

## cold_open

An agent can now send a widget with its own page.

Until this change, every widget window showed the same page. We wrote that page, and it drew the agent program with our fixed components. The agent chose the text of the program, never the components.

Now the agent can write its own React components and its own page. That page will run in a window on your desktop. Nobody reviews it first.

So the install must check it. This video is about those checks: what each one reads, what it refuses, and where it still has a hole.

## outline

Here is the whole path.

An agent writes a folder. It calls widget install with the path of that folder. The host runs the three gates that it ran before: compile, lint, and test run. A gate is a check that new code must pass before it reaches the host.

When the folder also holds a folder with the name page, four more gates run after those three. Their names are page files, page types, page build, and page render.

Each gate can refuse. The first gate that refuses stops the install. Nothing changes on your desktop.

When every gate passes, the built page goes into the profile folder, and the install goes live. We walk each box of this path, in order.

## from_the_plan

The widget kit video was the plan for this work. It is forty-three minutes long, and it ends on open questions.

This video is what we built. The plan holds in most places. In three places it does not, and I name each one when we reach it.

The earlier video also taught the parts that this one stands on. When we reach such a part, I give you the video and the time. The recap stays on one screen.

## core_and_child

The first part we stand on is the split of the page.

The page has two halves. The core is the half that no agent changes. It loads the program, sends each query and each mutation, reads the stream, and shows the states of the page. The child is one React component. It holds the renderer root and a component library.

They meet at one TypeScript type, child props. It has two fields, root and children. The core fills root. The child adds its own library and puts children inside.

The widget kit video teaches this at seven minutes twenty-nine seconds, and the contract at eight minutes flat.

New in this work: the core now lives in its own package, widget kit. The shell keeps only the default child.

## page_folder

So what does an agent write?

The bundle keeps its old shape. A folder with source, and inside it index dot t s, the host half: the actions and the state.

Next to source, the agent may add a folder with the name page. It holds five files. The agent may not change three of them. Two of them are the work of the agent.

Two of the fixed files are index dot h t m l and main dot t s x. The third is one block of styles dot c s s. The two of the agent are child dot t s x and library dot t s x.

The template gives each file. The agent fills the two, and leaves the rest alone.

## fixed_files

Why are three files fixed?

Index dot h t m l is the page itself. It holds the root element, one script tag, and the content security policy of the page. That policy limits what the page may load and connect to. The widget kit video covers the policy at thirty-eight minutes five seconds.

Main dot t s x is four lines of code. It imports the mount function from the core. It imports the child and the stylesheet. Then it calls that function.

Both files are the seam between the core and the child. An agent that edits them can route the page anywhere. So the gate holds them to the template, byte for byte.

## dw_core_block

The third fixed thing is a block inside a stylesheet.

The core draws four page states: loading, error, empty, and removed. Loading is two gray bars. Error is a red title with a retry button. Each of those boxes needs its styles, or the user sees an unstyled error.

The styles sit in a block of the page stylesheet, between two marker comments. The block holds six rules in a cascade layer with the name d w core. Each declaration carries important.

You already know why that beats an unlayered rule. For an important declaration, the layer order flips. So an important rule in a layer wins.

Now the catch. The agent can not override the block from an unlayered rule. It can open the same layer again lower down, and win there by order. The gate holds the text of the block to the template. The last gate then catches an override, and we reach it later.

## hash_idea

The gate compares files by hash.

A hash is a short fingerprint of the bytes of a file. The same bytes always give the same fingerprint. Different bytes almost always give a different one. The deepWidgets video uses a hash at twelve minutes fourteen seconds, as an idempotency key.

Here it does two jobs. First, it says whether a fixed file still matches the template. The gate hashes both and compares. Second, it names a build. The gate hashes the path and the bytes of every page file, in sorted order. It keeps the first sixteen characters.

So the same page sources always give the same build name, and a changed page gives a new one.

## gate_files

Now the first gate, page files.

It makes three comparisons. It hashes index dot h t m l against the template. It hashes main dot t s x against the template. It pulls the d w core block out of the page stylesheet. Then it hashes that against the template block.

A missing file is a problem. A changed file is a problem. A stylesheet with no block, or with two blocks, is a problem.

Each problem becomes one line with the file name and the fix. The answer also carries a next step: restore the file from the template, then call widget install again. The install changed nothing.

This gate reads files only. It runs before any build, so it costs almost nothing.

## symlink_teach

The gate also refuses one more thing, and it needs a new word.

A symbolic link is a file whose content is a path. When a program opens it, the system follows the path and opens the target instead. Think of a street sign that says the shop is around the corner. The sign is not the shop, and it can point at any address.

Make one like this. Link, dash s, the target, then the name. Now the name behaves like the target. The target can sit anywhere on the disk, even outside the folder in front of you.

That last part is the catch. A folder can look small and self contained, and still reach your whole disk through one link.

## gate_files_links

So a page may hold no symbolic link at all.

The gate walks the page folder at every depth. Each link becomes a problem line with its path and the fix. The fix is to copy the file into the page folder.

Why refuse the link instead of following it and checking the target? Because a check on the target has a race. The gate reads the target, likes it, and the agent then points the link somewhere else before the build. A refusal has no such gap.

The check proves this one. It plants a link with the name leak dot t s in a page. The install then fails at the gate page files.

## staging_copy

The next gate needs the page somewhere else.

The gates never work in the folder of the agent. They copy it first. The copy goes under the profile folder, into a folder with the name dot page staging. Each run gets a fresh name.

The copy takes the page folder and nothing else. The copy skips a node modules folder inside the page, so the gates never read it.

Next to the copy, the gates write three small files. Two are configs, one for t s config and one for oxlint. The third is one line of types. It says that a stylesheet import has no value.

The copy and its configs go at the end of the run, whether the gates pass or fail.

## linked_modules

Beside the copy sits a node modules folder of symbolic links.

It holds eight links. Five are packages of the list: react, react dom, open u i react lang, zod, and the widget kit. The other three are two type packages and the shell.

That is the whole trick of the type gate. A page that imports recharts gets no resolution, because no link with that name exists. The compiler then reports that it can not find the module. The error is a plain missing module error, not a rule of ours.

The check plants exactly that import. It expects the code T S two three zero seven, the missing module error of TypeScript.

## one_copy_rule

Which copy does each link point at?

Not any copy. The gates ask the widget kit to resolve react and react dom. The page then gets the same copy as the core. Two copies of React in one page do not work together.

Zod is harder. Zod is a peer dependency of open u i react lang, and you know what that means. So the gates first resolve open u i react lang, then resolve zod from inside that folder. The page and open u i then share one zod.

That matters because the components of an agent declare their props with a zod schema. Two zod copies would make those schemas fail a type check against each other.

## gate_types

The type gate itself runs the same tool as the lint gate of the host.

It runs oxlint with the type aware flag and the type check flag. It uses the t s config of the staging copy. The deepWidgets video covers that tool at twenty-five minutes fifty-one seconds.

The gate has a limit of sixty seconds. It reports at most twenty problems. Each problem keeps its file, its line, and its column. The gate strips the staging path off, so the agent sees a path under page.

Two kinds of failure land here. A plain type error, such as a string assigned to a number. And an import of a package that no link resolves.

## plugin_hook_teach

The third gate builds the page, and to follow it you need one word about bundlers.

A bundler plugin is an object with named functions. The bundler calls each function at a fixed point of the build. Each such function is a hook. Think of a kitchen inspector at two doors. One door is the delivery entrance. The other is the pass, where the food leaves.

Two hooks matter here. Resolve i d runs for every import. It gets the text of the import and the file that asked for it, and it can refuse. Generate bundle runs once at the end, with the finished bundle in hand.

A plugin can also ask to run early, with a field that says pre. Our fence asks for that, so it sees an import before any other plugin rewrites it.

## import_fence

The first fence sits on the resolve i d hook.

It only looks at imports that come from a file of the page. An allowed package imports its own files and its own dependencies, and the fence lets those through without a look.

For a page file it splits imports in two. A bare import names a package, like react. A path import starts with a dot or a slash. The widget kit video gives the term bare import at five minutes twenty-one seconds.

A bare import must be on the list, exactly, or under one of two prefixes for the shell pieces. A path import must resolve to a file inside the page folder.

It also refuses a package subpath that holds dot dot, a single dot, or an empty segment. Such a path can climb out of the folder that a package means to expose.

## fence_hole

That fence is not enough, and it is worth seeing why.

The fence reads imports. It never sees a file that enters the page some other way. There are several other ways.

A stylesheet can pull in another stylesheet with an at import rule. A stylesheet can name an image with a function. A script can build a file path with the new U R L form and the module address. A plugin can read a file on its own, with no import at all.

We shipped the syntax checks first, for the forms we knew. A reviewer then found four more forms that got past them. One was an at import with no space after the keyword. Each fix of a form invites the next form.

So the second fence does not read syntax at all. It reads the result.

## module_graph_teach

For that, two more words.

While a bundler builds, it keeps a record of every module it pulled in, with the path of each one. That record is the module graph. The bundler also keeps a list of files that it read but did not turn into modules. A stylesheet that it followed is one. Those are the watch files.

At the end, the bundler emits files next to the scripts: an image, a font, a stylesheet. Each emitted file remembers the path it came from.

So the finished build can answer one question: which files on this disk went into this page? That question has one answer, whatever syntax put them there.

## data_url_teach

One more word, because it hides a file in plain sight.

A bundler does not always emit a small file as its own file. Below a size limit it embeds the bytes inside the script or the stylesheet, as text. That form is a data U R L. The page then holds a copy of the file and loads nothing.

Here is the trap. An embedded file is not a file in the output folder. A check that looks at the output folder finds nothing wrong. The bytes are in the page all the same.

Two of the four bypasses worked exactly this way. A secret file came in as a data U R L, and the output folder looked clean.

## monkey_patch_teach

And one last word, for the files a plugin reads on its own.

A built-in module of Node holds plain functions, and a program can replace one of them while it runs. That is monkey patching. You keep the original, put your own function in its place, record what you want, then call the original.

The build child does this to the file module of Node. It wraps five functions of the file module, and two of its promise form. Each one records its path, then passes the call on. One call then makes the wrapped versions visible to code that imported those functions by name.

It has a limit, and the code says so. A native module reads files through its own code, not through Node, so those reads are invisible here. The Tailwind scanner is such a module, and it reports its files as watch files instead.

## output_fence

Now the second fence, on the generate bundle hook.

At the end of the build it gathers four lists. The first two are every module of the module graph and every watch file. The third is the original path of every emitted file. The fourth is every path that the monkey patching recorded.

For each path it asks the system for the real path, which follows every link to the file itself. Then it compares. A real path inside the page copy is fine. A real path inside the staging folder is fine. A real path inside one of the allowed package folders is fine.

Anything else fails the build, with the count and the first five paths. One exemption stays, and I come back to it at the end.

This is the guard. The syntax checks stayed, but only where they give a clearer error than a list of paths.

## postcss_teach

Two of those syntax checks are about the style toolchain, and they need one word.

Post c s s is the tool that a bundler runs over a stylesheet. It parses the sheet, hands it to a list of plugins, and writes it out again. Tailwind is one such plugin.

Post c s s looks for a configuration file in the folder of the project. It runs whatever that file lists. That is the problem. A configuration file is a list of code to run, and the agent owns the page folder.

The build passes its own configuration inline instead, so the tool looks for no file at all.

## stylesheet_checks

With that, three rules on a page stylesheet.

The page may hold no post c s s or Tailwind configuration file. The gate finds one by its name and refuses it.

A page stylesheet may hold no at plugin rule and no at config rule. Both of those load code by name. The gate strips the comments out of the sheet and looks for the two keywords.

The output fence would catch the file that such a rule pulls in. These three rules exist for the error message. A line that names the file and the rule beats a list of five paths.

## build_child

The build runs in its own process.

The gate writes the job to a file, starts a child with the path of that file, and waits. The child builds, then prints one line to its output. The line starts with the word result and holds the answer as J S O N.

Why a separate process? A build has long steps that do not pause. The host has a watchdog that stops it when its heartbeat stops. A build inside the host would look like a frozen host.

The gate gives the child ninety seconds. If the child passes that, the gate kills it and reports that the build took too long. The gate also fails when the child ends with no result line, and when the build wrote no index page.

## ipc_teach

The last gate needs the browser, and the host has none. So it asks.

Two processes that must talk need a channel. Node gives a child process one: the parent and the child each send an object and each listen for one. That channel is inter process communication, or I P C.

A channel carries messages in both directions, but a message is not a question. To make a question, you add a number. The asker keeps a counter and puts the next number on the message. Then it waits for an answer with the same number. Then two questions in flight can not take each other answers.

The deepWidgets video draws these processes at five minutes forty-two seconds: Electron main, the host as its child, and a renderer for each window.

## check_route

The browser needs a page to load, and the page needs an address.

The app serves its own addresses under a scheme of its own. The live widget page sits under one host name. The render check gets a second host name, which belongs to the check alone.

That second address serves one thing. It serves the files of the build under check, and nothing else. It resolves each link and refuses any path that leaves the folder of the slug.

A page there can not reach the live app. The content security policy of the page allows connections to its own address only.

## test_run_fixture

The page then asks for its data, and the check answers from a recording.

Remember the third host gate, the test run. The deepWidgets video covers it at twenty-six minutes fifty-five seconds. It runs the bundle in a throwaway process and calls each action once.

New in this work: that run now keeps what each query returned. The check uses those answers.

So the check answers three routes itself. Program gives the recorded program text. Call gives the recorded answer for the action by name. Stream sends one hello and stays open, so the page does not open it again.

The page never reaches the live host. It renders the real program against real recorded data, with nothing live behind it.

## hidden_window

Now the window.

Electron main opens a browser window of three hundred twenty by three hundred, the size of a real widget window. It never shows: the show flag is false. The window has no frame, no Node access, and a sandbox.

The check listens for three things on that window. Console errors, which it keeps. The renderer ending, which it records with the reason. And it refuses navigation and new windows outright.

One check runs at a time. Each new check joins a queue and waits for the one before it. The answer travels back to the host over the same I P C channel.

## deadline

That queue is why the next part matters.

A page can hold its renderer forever. A loop at the top level of the page never yields. So the load never finishes, and the function that waits for it never settles.

Our first version put a ten second limit on the wait for ready. That limit started only after the load. A looping page never got that far. The window spun until the app quit, and the queue never moved, so every later check failed at forty-five seconds.

The fix is one deadline over the whole thing, load and judgement together, at fifteen seconds. When it fires, the check crashes the renderer, destroys the window, and frees the queue. The answer is not ready, with the console lines as detail.

This is the first of the three places where the plan did not hold.

## shadow_dom_teach

The check also looks at the styles, and that uses a browser feature you have not met.

An element can hold a second, separate document inside itself, called a shadow root. Styles of the page do not reach inside it, and styles inside it do not leak out. Think of a sealed display case in a shop. You see through it, but the shop lighting does not reach inside.

The seal is not total, and the gap matters here. Inherited properties still pass in from the host element, and custom properties pass in too. So a shadow root is a fresh style scope, not a fresh style universe.

You make one with attach shadow on an element, then you put markup and a stylesheet inside.

## style_probe

Here is how the check uses it.

The page may have lost the protected styles. To know that, the check needs the right answer to compare against. It builds the right answer in the page itself.

It makes two hidden boxes. In the first it puts the state markup, where every stylesheet of the page applies. In the second it attaches a shadow root. It puts the same markup inside, with one stylesheet: the d w core block of the template.

Then it reads the computed style of each matching pair, for six boxes and their properties, and compares. A value that differs means the page changed a protected style, and the check reports which property on which box.

Every property it compares is a property that the block itself sets. A style of the agent that only moves a box does not fail the check.

## render_verdicts

So the render gate has three refusals and three warnings.

It refuses when a component threw while the page drew the program. It refuses when the page never reached ready. It refuses when a protected style was lost.

It warns when the body of the page has no height. It warns when the content is wider than the window. It warns when the program itself reported errors.

A warning rides along with a successful install. The agent sees it and can fix it. A refusal stops the install.

The reason for that split is simple. A page with no height is probably wrong, but a person may have meant it. A component that throws is wrong in every reading.

## cli_skip

One host has no browser at all.

The app starts the host as its child, and that host can ask Electron main for the check. Our checks start a host straight from the command line, with no app around it. That host has nobody to ask.

There the render gate does not run. It passes, and it adds a warning to the install answer. The warning says that this host has no Electron main, so the check did not run.

That is a real gap in our own test runs, and it is on purpose. Only our checks and our development runs use such a host. Your app always runs the full check.

## rename_teach

The gates built the page and checked it. To put it in place, you need one more word.

A rename is special among file operations. The system either completed it or did not. There is no moment where a reader sees half a rename. A copy has no such promise: a reader can see a file that is half written.

So the pattern is: build somewhere else, then rename into place. Never write over the thing that readers hold open.

That is how the crash record of the host already works. The deepWidgets video mentions it at thirty minutes forty-eight seconds, in one line, without the reason. Here the reason is the whole design.

## tmp_build

The first version of this code copied, and that was wrong.

It built the page into a temporary folder, deleted the old page, and copied the new one in. It did that after the new code was already live. A crash during the copy left the widget with no page, or half a page.

Now there is no copy at all. Vite builds straight into the folder of the slug. Its name is page, then the hash, then dot t m p. The render check loads that folder.

When every gate passes, one rename drops the dot t m p. When a gate fails, the folder goes, and the current page stays.

This is the second place where the plan did not hold.

## page_link

The last step is the swap, and it uses the link you learned.

In the folder of a slug there is an entry with the name page. It is a symbolic link, and it points at one build folder.

After the install applies, the swap goes like this. Make a new link under a temporary name, pointing at the new build. Then rename that link over the name page. A reader sees the old build or the new build, and never nothing.

The order matters. The link swaps only after the install applies. An install that fails at the last step leaves the old page in place. That page serves the old code, which still runs.

## keep_three

The old builds do not go.

Each slug keeps three builds: the current one and the two newest others. The code removes the rest by age.

Why keep them? A reinstall of the same sources keeps the build that is there, instead of replacing it. And a later unit will pin a widget to a version. It can point the link back at an old build with one rename.

The kit spike measured a page of this kind at about three hundred sixty to eight hundred kilobytes. So three of them cost little.

A reinstall with no page folder removes the link and keeps the builds.

## sweep

A host can stop in the middle of all this.

It can stop during the staging copy, during the build, or between the two renames of the link. Each of those leaves something behind. It is a staging folder, a dot t m p build, or a link under its temporary name.

So the first job of the installer queue, at every host start, removes all three kinds. A removal that fails stays for the next start.

The names carry the design. The serving code refuses that name, so a dot t m p build never reaches a window. A link under a temporary name is never the name page. Each leftover is both inert and easy to find.

## example_setup

Now one real page, end to end.

The check writes a page widget with the slug create page. Its library declares a component with a zod schema, so it proves that the shared zod works. Its child renders the renderer root with that library.

The host gates run first: compile, lint, and the test run. The test run records the program and the answer of the one query.

Then the four page gates run. Here is what each one did on the real run.

## example_pass

Page files hashed three things and found three matches.

Page types copied the page, linked eight packages, and ran the type check with no error.

Page build started its child. The child checked the stylesheet, started Vite with its four plugin entries, and built the page. One build takes about one and a quarter seconds. The output fence found every file inside the page or the allowed packages.

Page render loaded the built folder in the hidden window. The page reached ready, the six style boxes matched, and the gate passed in six hundred forty-eight milliseconds.

The install then applied and the link swapped. The built index page names the base path slash widget slash create page slash. That proves that each page gets its own base.

## example_refuse

Now the same page with one line added.

The line builds a path to a file three folders up, with the new U R L form. Then it exports its address. The file is a secret file that the check planted outside the page.

Page files passes: no fixed file changed. Page types passes: new U R L is valid TypeScript with no import. The import fence sees nothing, because there is no import.

Then Vite inlines that file as a data U R L. The output fence sees its real path in the recorder list. The build fails, and the message names the file.

The install stops at page build. The old bundle and the old page link stay, and no dot t m p folder is left behind.

## example_loop

And the loop case, which runs with the app.

The page holds a loop at the top level of the child file, and it never ends. The check planted one, and found a trap of its own. The bundler removed the first loop, because it had no effect. So the loop writes the document title, and now it survives.

The window loads and never yields. The deadline fires at fifteen seconds. The check crashes the renderer, destroys the window, and frees the queue.

The install fails with not ready. The reviewer measured the whole case at eighteen seconds. A good page installed right after it, and passed in six hundred fifty-four milliseconds. That second half is the part that matters: the queue really did free.

## twelve_cases

The checks hold thirteen refusals.

Two land on page files: a changed fixed file, and a changed protected block. One more lands there for a symbolic link.

Two land on page types: a plain type error, and an import of recharts.

Eight land on page build. One is an import of a file outside the page. Three are at import forms that reach a secret file. One of those three has no space after the keyword.

Four more land there too. One is a bare string inside an image function. One is the new U R L form. The last two are an at plugin rule and a configuration file.

Each case asserts the gate name and the diagnostic. All but the link case also assert that a next step came back.

## mutants

We then tested each of those checks.

You know the idea from today: remove the thing the check guards, rebuild, and the check must fail. A check that never fails proves nothing.

Three mutants ran here. Without the render check, the loop page installs and the suite fails. Without the lost style line, the broken style case is not refused. Without the warning lines, the warning case reports no warning.

The four bypasses were also tested with the syntax checks turned off. All four stayed refused, which proves that the output fence catches them on its own, and not the syntax checks.

## limits_open

Three things stay open. Here are the numbers.

First, the resolver needs to read package and t s config files. So the build may read any file with those names, anywhere on the disk. A page can still embed such a file under four kilobytes, with the new U R L form. Inside a worker it can read one of any size.

Second, a worker of a page builds with no import fence at all. A test worker pulled in a charting library of seven hundred twenty kilobytes.

Third, the allowed set grew. The gate links eight packages. The code follows their dependencies. For a workspace package it follows the development dependencies too. The walk reached one thousand one hundred fifty-two folders. A scan found no secret files in them.

The fix for the first two is about two lines. The third needs a narrower walk.

This is the third place where the plan did not hold.

## not_served

One more thing stays undone, and it is the obvious one.

Your widget window still shows the shared shell. The built page sits in the profile folder, checked and linked, and nothing serves it.

That is the next unit, and its name is library serving. Electron main will serve the link of each slug. A slug with no page falls back to the shared shell.

So today the gate is real, and the page it guards is not on screen yet.

## closing

That is the page build gate.

There are four gates. The first checks the fixed files by hash. The second checks the types against eight linked packages. The third builds behind two fences. The fourth renders in a hidden window, against recorded data.

One idea runs through all of it. Check the result, not the syntax. The import fence reads what the agent wrote, and it kept losing to a new form of writing. The output fence reads what landed in the page. A form that it has never seen still shows up as a path.

The places where the plan did not hold were all of the same kind too. A limit that starts too late. A copy where a rename belongs. A set that grew wider than its own specification.
