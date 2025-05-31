module.exports = {
    appId: "com.ghosttypes.flashforgeui",
    productName: "FlashForgeUI",
    copyright: `Copyright © ${new Date().getFullYear()} GhostTypes`,

    // Shared configurations
    directories: {
        output: "dist",
        buildResources: "assets",
    },
    asar: true,

    files: [
        // Include
        "src/bootstrap/**.*",
        "src/constants/IPCChannels.js",
        "src/index.js",
        "src/index.css",
        "src/index.html",
        "src/preload.js",
        "src/renderer.js",
        "src/icons/**/*",
        "src/utils/**/*.js",
        "src/managers/**/*.js",
        "src/services/**/*.js",
        "src/ui/**/*.{js,html,css}",
        "src/web/**/*.{js,html,css}",
        "package.json",
        "node_modules/**/*",

        // Exclude
        "!**/elevate.exe",
        "!**/.git/**",
        "!**/.vscode/**",
        "!**/.idea/**",
        "!**/node_modules/**/{README,CHANGELOG,AUTHORS,CONTRIBUTING}*",
        "!**/node_modules/**/{test,__tests__,tests,powered-test,example,examples}/**",
        "!**/node_modules/**/*.{ts,tsx,d.ts,map}",
        "!**/node_modules/**/.*",
        "!**/node_modules/**/.bin/**",
        "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
        "!**/.*", // Exclude all dot files/folders
        "!**/*.md",
        "!**/docs/**",
        "!**/samples/**",
        "!**/demo/**",
    ],

    // Native module handling
    npmRebuild: false,
    nodeGypRebuild: false,

    // Windows configuration
    win: {
        icon: "src/icons/icon.ico",
        target: [
            {
                target: "nsis",
                arch: ["x64"],
            },
            {
                target: "zip",
                arch: ["x64"],
            },
        ],
    },

    // macOS configuration
    mac: {
        icon: "src/icons/icon.icns",
        category: "public.app-category.utilities",
        target: [
            {
                target: "dmg",
                arch: ["universal"],
            },
        ],
    },

    // Linux configuration
    linux: {
        icon: "src/icons/icon.png",
        category: "Utility",
        target: ["AppImage", "deb", "rpm"],
        maintainer: "GhostTypes",
        vendor: "GhostTypes",
    },

    // NSIS Windows installer configuration
    nsis: {
        oneClick: true,
        perMachine: false,
        allowToChangeInstallationDirectory: false,
        deleteAppDataOnUninstall: true,
    },

    // DMG configuration
    dmg: {
        contents: [
            {x: 130, y: 220},
            {x: 410, y: 220, type: "link", path: "/Applications"},
        ],
    },

    // DEB configuration
    deb: {
        afterInstall: "build/linux/afterInstall.sh",
        afterRemove: "build/linux/afterRemove.sh",
    },

    // RPM configuration
    rpm: {
        afterInstall: "build/linux/afterInstall.sh",
        afterRemove: "build/linux/afterRemove.sh",
    },
};