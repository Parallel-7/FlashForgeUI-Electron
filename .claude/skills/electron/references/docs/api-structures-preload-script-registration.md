# Source: https://www.electronjs.org/docs/latest/api/structures/preload-script-registration

* `type` string - Context type where the preload script will be executed.
Possible values include `frame` or `service-worker`.
* `id` string (optional) - Unique ID of preload script. Defaults to a random UUID.
* `filePath` string - Path of the script file. Must be an absolute path.