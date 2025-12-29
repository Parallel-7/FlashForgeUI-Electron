# Third-party extensions

These are extension maintained by other communities, that you install in your editor:

* [`vim`](https://www.vim.org/): [`ALE`](https://github.com/dense-analysis/ale) supports Biome, just follow the installation instructions
* [`neovim`](https://neovim.io/): you’ll have to install [`nvim-lspconfig`](https://github.com/neovim/nvim-lspconfig/), and follow the [instructions](https://github.com/neovim/nvim-lspconfig/blob/master/doc/configs.md#biome). [`ALE`](https://github.com/dense-analysis/ale) also supports Biome.
* [`helix`](https://helix-editor.com/): follow the instruction of [this manual](#helix)
* [`coc-biome`](https://github.com/fannheyward/coc-biome): Biome extension for [`coc.nvim`](https://github.com/neoclide/coc.nvim)
* [`sublime text`](https://www.sublimetext.com/): follow the [`LSP-biome`](https://github.com/sublimelsp/LSP-biome) installation instructions
* [`Emacs`](https://www.gnu.org/software/emacs/): ensure you have [`lsp-mode`](https://github.com/emacs-lsp/lsp-mode) installed, follow the [`lsp-biome`](https://github.com/cxa/lsp-biome) installation instructions to enable Biome support in `lsp-mode`
* [`Nova`](https://nova.app): install [`Biome`](https://extensions.panic.com/extensions/besya/besya.biome/) extension and follow the instructions

Note

Is there a extension for an editor that isn’t listed here? Please file a PR and we will be happy to add it to the list

### Helix


Currently, biome supports the following file extensions: `js`, `jsx`, `ts`, `tsx`, `d.ts`, `json` and `jsonc`.

Biome has an `lsp-proxy` command that acts as a server for the Language Server Protocol over stdin/stdout.

#### Helix 23.10


Helix 23.10 has [support for multiple language servers](https://github.com/helix-editor/helix/pull/2507). Now you can use biome alongside `typescript-language-server`.

```
[language-server]

biome = { command = "biome", args = ["lsp-proxy"] }

[[language]]

name = "javascript"

language-servers = [ { name = "typescript-language-server", except-features = [ "format" ] }, "biome" ]

auto-format = true

[[language]]

name = "typescript"

language-servers = [ { name = "typescript-language-server", except-features = [ "format" ] }, "biome" ]

auto-format = true

[[language]]

name = "tsx"

auto-format = true

language-servers = [ { name = "typescript-language-server", except-features = [ "format" ] }, "biome" ]

[[language]]

name = "jsx"

auto-format = true

language-servers = [ { name = "typescript-language-server", except-features = [ "format" ] }, "biome" ]

[[language]]

name = "json"

language-servers = [ { name = "vscode-json-language-server", except-features = [ "format" ] }, "biome" ]
```

### Video record


#### Code Action


[](https://user-images.githubusercontent.com/17974631/190205045-aeb86f87-1915-4d8b-8aad-2c046443ba83.mp4)

#### Formatting


[](https://user-images.githubusercontent.com/17974631/190205065-ddfde866-5f7c-4f53-8a62-b6cbb577982f.mp4)
