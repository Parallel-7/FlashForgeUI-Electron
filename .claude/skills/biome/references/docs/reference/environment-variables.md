# Environment variables

### `BIOME_LOG_PREFIX_NAME`


A prefix that’s added to the name of the log. Default: `server.log.`

### `BIOME_LOG_PATH`


The directory where the Daemon logs will be saved.

### `BIOME_CONFIG_PATH`


A path to the configuration file

### `BIOME_BINARY`


Overrides the Biome binary being used. This allows you, for example, to use a system-wide Biome binary.

If you don’t define this variable, Biome will automatically detect the correct binary for your platform.

```
# Nix derivation example; the binary path comes from "${pkgs.biome}/bin/biome"

BIOME_BINARY=/nix/store/68fyfw1hidsqkal1839whi3nzgvqv4pa-biome-1.0.0/bin/biome npx @biomejs/biome format .
```
