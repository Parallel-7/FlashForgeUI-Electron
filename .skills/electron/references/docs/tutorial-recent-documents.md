# Source: https://www.electronjs.org/docs/latest/tutorial/recent-documents

On this page

## Overview[â](#overview "Direct link to Overview")

Windows and macOS provide access to a list of recent documents opened by
the application via JumpList or dock menu, respectively.

**JumpList:**

![JumpList Recent Files](https://cloud.githubusercontent.com/assets/2289/23446924/11a27b98-fdfc-11e6-8485-cc3b1e86b80a.png)

**Application dock menu:**

![macOS Dock Menu](https://cloud.githubusercontent.com/assets/639601/5069610/2aa80758-6e97-11e4-8cfb-c1a414a10774.png)

## Example[â](#example "Direct link to Example")

### Managing recent documents[â](#managing-recent-documents "Direct link to Managing recent documents")

[docs/fiddles/features/recent-documents (40.0.0)](https://github.com/electron/electron/tree/v40.0.0/docs/fiddles/features/recent-documents)[Open in Fiddle](https://fiddle.electronjs.org/launch?target=electron/v40.0.0/docs/fiddles/features/recent-documents)

* main.js* index.html

```
const { app, BrowserWindow } = require('electron/main')
const fs = require('node:fs')
const path = require('node:path')

function createWindow () {
const win = new BrowserWindow({
width: 800,
height: 600
})

win.loadFile('index.html')
}

const fileName = 'recently-used.md'
fs.writeFile(fileName, 'Lorem Ipsum', () => {
app.addRecentDocument(path.join(__dirname, fileName))
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
app.clearRecentDocuments()
if (process.platform !== 'darwin') {
app.quit()
}
})

app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) {
createWindow()
}
})
```

```
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Recent Documents</title>
<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';" />
</head>
<body>
<h1>Recent Documents</h1>
<p>
Right click on the app icon to see recent documents.
You should see `recently-used.md` added to the list of recent files
</p>
</body>
</html>
```

#### Adding a recent document[â](#adding-a-recent-document "Direct link to Adding a recent document")

To add a file to recent documents, use the
[app.addRecentDocument](/docs/latest/api/app#appaddrecentdocumentpath-macos-windows) API.

After launching the Electron application, right click the application icon.
In this guide, the item is a Markdown file located in the root of the project.
You should see `recently-used.md` added to the list of recent files:

![Recent document](/assets/images/recent-documents-d86e2866546b01a075b73d23b14fb56f.png)

#### Clearing the list of recent documents[â](#clearing-the-list-of-recent-documents "Direct link to Clearing the list of recent documents")

To clear the list of recent documents, use the
[app.clearRecentDocuments](/docs/latest/api/app#appclearrecentdocuments-macos-windows) API.
In this guide, the list of documents is cleared once all windows have been
closed.

#### Accessing the list of recent documents[â](#accessing-the-list-of-recent-documents "Direct link to Accessing the list of recent documents")

To access the list of recent documents, use the
[app.getRecentDocuments](/docs/latest/api/app#appgetrecentdocuments-macos-windows) API.

## Additional information[â](#additional-information "Direct link to Additional information")

### Windows Notes[â](#windows-notes "Direct link to Windows Notes")

To use this feature on Windows, your application has to be registered as
a handler of the file type of the document, otherwise the file won't appear
in JumpList even after you have added it. You can find everything
on registering your application in [Application Registration](https://learn.microsoft.com/en-us/windows/win32/shell/app-registration).

When a user clicks a file from the JumpList, a new instance of your application
will be started with the path of the file added as a command line argument.

### macOS Notes[â](#macos-notes "Direct link to macOS Notes")

#### Add the Recent Documents list to the application menu[â](#add-the-recent-documents-list-to-the-application-menu "Direct link to Add the Recent Documents list to the application menu")

You can add menu items to access and clear recent documents by adding the
following code snippet to your menu template:

```
{
"submenu":[
{
"label":"Open Recent",
"role":"recentdocuments",
"submenu":[
{
"label":"Clear Recent",
"role":"clearrecentdocuments"
}
]
}
]
}
```

Make sure the application menu is added after the [`'ready'`](/docs/latest/api/app#event-ready)
event and not before, or the menu item will be disabled:

```
const { app, Menu } = require('electron')

const template = [
// Menu template here
]
const menu = Menu.buildFromTemplate(template)

app.whenReady().then(() => {
Menu.setApplicationMenu(menu)
})
```

![macOS Recent Documents menu item](https://user-images.githubusercontent.com/3168941/33003655-ea601c3a-cd70-11e7-97fa-7c062149cfb1.png)

When a file is requested from the recent documents menu, the `open-file` event
of `app` module will be emitted for it.

* [Overview](#overview)* [Example](#example)
+ [Managing recent documents](#managing-recent-documents)
- [Adding a recent document](#adding-a-recent-document)- [Clearing the list of recent documents](#clearing-the-list-of-recent-documents)- [Accessing the list of recent documents](#accessing-the-list-of-recent-documents)* [Additional information](#additional-information)
+ [Windows Notes](#windows-notes)+ [macOS Notes](#macos-notes)
- [Add the Recent Documents list to the application menu](#add-the-recent-documents-list-to-the-application-menu)