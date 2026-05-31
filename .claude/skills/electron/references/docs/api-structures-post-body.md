# Source: https://www.electronjs.org/docs/latest/api/structures/post-body

* `data` ([UploadRawData](/docs/latest/api/structures/upload-raw-data) | [UploadFile](/docs/latest/api/structures/upload-file))[] - The post data to be sent to the
new window.
* `contentType` string - The `content-type` header used for the data. One of
`application/x-www-form-urlencoded` or `multipart/form-data`. Corresponds to
the `enctype` attribute of the submitted HTML form.
* `boundary` string (optional) - The boundary used to separate multiple parts of
the message. Only valid when `contentType` is `multipart/form-data`.