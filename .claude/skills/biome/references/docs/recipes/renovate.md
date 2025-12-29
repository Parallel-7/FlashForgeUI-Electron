# Renovate

[Renovate](https://docs.renovatebot.com/) is a popular tool for automated dependency updates.

## biome.json


Renovate has a [shared preset rule](https://docs.renovatebot.com/presets-customManagers/#custommanagersbiomeversions) that can help keep the `$schema` version in-sync and up-to-date within the `biome.json` configuration files.

To use, add `customManagers:biomeVersions` to your `extends` list.

renovate.json

```
{

"$schema": "https://docs.renovatebot.com/renovate-schema.json",

"extends": ["customManagers:biomeVersions"]

}
```
