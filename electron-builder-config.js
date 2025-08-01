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

    // Optimize web UI assets - only include essential files
    extraResources: [
        {
            from: "dist/renderer",
            to: "renderer",
            filter: ["index.html", "renderer.bundle.js", "vendors.bundle.js", "**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}"]
        },
        {
            from: "dist/webui",
            to: "webui",
            filter: ["**/*.{html,js,css,png,jpg,jpeg,gif,svg,ico,woff,woff2,ttf,eot}"]
        }
    ],

    files: [
        "lib/**/*.js",         // Main process files
        "dist/renderer/**/*",  // Renderer bundle and assets - CRITICAL for web UI

        // Include icons for platform builds
        "src/icons/**/*",

        // Include UI files (HTML, CSS) for dialogs
        "src/ui/**/*",

        // Include built web UI static assets
        "dist/webui/**/*",

        "package.json",

        // Exclude (same as JS project)
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
        "!**/*.yml",
        "!**/*.yaml",
        "!**/*.blockmap",

        // Exclude source TypeScript files from the bundle (keep compiled JS)
        "!**/*.ts",
        "!**/tsconfig.json",

        // Exclude test files
        "!**/__tests__/**",
        "!**/*.test.*",
        "!**/*.spec.*"
    ],

    // Native module handling
    npmRebuild: false,
    nodeGypRebuild: false,




    // Windows configuration
    win: {
        icon: "src/icons/icon.ico",

        signAndEditExecutable: true,
        target: [
            {
                target: "nsis",
                arch: ["x64"],
            },
            {
                target: "portable",
                arch: ["x64"],
            },
        ],
    },


    portable: {
        // This ensures the portable executable gets the proper treatment
        requestExecutionLevel: "user",
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

    // NSIS Windows installer configuration (EXACT same as JS project)
    nsis: {
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        deleteAppDataOnUninstall: true,
    },

    // DMG configuration
    dmg: {
        contents: [
            { x: 130, y: 220 },
            { x: 410, y: 220, type: "link", path: "/Applications" },
        ],
    },

    // DEB configuration
    deb: {
        afterInstall: "assets/linux/afterInstall.sh",
        afterRemove: "assets/linux/afterRemove.sh",
    },

    // RPM configuration
    rpm: {
        afterInstall: "assets/linux/afterInstall.sh",
        afterRemove: "assets/linux/afterRemove.sh",
    },
};
