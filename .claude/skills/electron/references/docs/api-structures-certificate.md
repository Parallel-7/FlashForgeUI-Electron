# Source: https://www.electronjs.org/docs/latest/api/structures/certificate

* `data` string - PEM encoded data
* `issuer` [CertificatePrincipal](/docs/latest/api/structures/certificate-principal) - Issuer principal
* `issuerName` string - Issuer's Common Name
* `issuerCert` Certificate - Issuer certificate (if not self-signed)
* `subject` [CertificatePrincipal](/docs/latest/api/structures/certificate-principal) - Subject principal
* `subjectName` string - Subject's Common Name
* `serialNumber` string - Hex value represented string
* `validStart` number - Start date of the certificate being valid in seconds
* `validExpiry` number - End date of the certificate being valid in seconds
* `fingerprint` string - Fingerprint of the certificate