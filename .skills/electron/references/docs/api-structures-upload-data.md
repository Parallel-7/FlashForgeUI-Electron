# Source: https://www.electronjs.org/docs/latest/api/structures/upload-data

* `bytes` Buffer - Content being sent.
* `file` string (optional) - Path of file being uploaded.
* `blobUUID` string (optional) - UUID of blob data. Use [ses.getBlobData](/docs/latest/api/session#sesgetblobdataidentifier) method
to retrieve the data.