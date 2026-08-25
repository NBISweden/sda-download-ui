# Deployment

This project can be deployed using either the default design or version with customized colors.

## Deploying a version with default design

### Initial configuration
In order to deploy the project you will need to create a configuration
file. As a starting point for your config file you can copy
`sdad-config.json.example` to `sdad-config.json`.

The example config includes `sessionSecretPath` which points to the
path where `frontend-token-secret` is located. Configuring the secret
involves creating the file `secrets/frontend-token-secret.txt`.
This can be done by using the following command:

```sh
openssl rand -base64 32 > secrets/frontend-token-secret.txt
```

In the `secrets` folder you also need to create the files
- `frontend-next-auth-secret.txt`
- `frontend-oidc-client-id`
- `frontend-oidc-client-secret`

The options available in the config file can be described as follows:
| Option | Type | Description |
| :----- | :--- | :---------- |
| `sessionSecretPath` | File path | Path to session secret file. |
| `oidcClientSecretPath` | File path | Path to OIDC client secret file. |
| `oidcClientIdPath` | File path | Path to OIDC client id file. |
| `sdaBaseUrl` | HTTP url | The base url to the SDA Download API. |
| `nextAuthUrl` | HTTP url | The url to use for authenticatin in the app. |
| `oidcRoot` | HTTP url | Url to the OIDC provider. |
| `allowHttp` | boolean | (Optional) Default is `false`. Recommendation for development setup is `true` and in production this option should be `false` or unset. | 

### Startup

Run

``` sh
./compose-prod.sh up
```
This will pull the latest Docker image from [the NBIS Docker Hub](ghcr.io/nbisweden/sda-download-ui) and run the project based on that.


## Deploying a customized version

The user interface is built with a design using eight base colors. To customize these colors you need to create a file `frontend/src/app/_theme_vars.local.scss`. Create it by copying the example file `frontend/src/app/_theme_vars.local.scss.example`. You will find eight color variables defined by rgb-codes that you can change to set different colors.

### Choosing colors

Be careful when choosing a new set of colors. The default color scheme has been thoroughly tested to fulfill design best practices and [web accessibility standards](https://www.w3.org/TR/WCAG21/). It works well even for visually impaired people (i.e. different variants of color blindness). If you are deploying this project as a public organization in Sweden, you are [required by law](https://www.digg.se/webbriktlinjer/lagar-och-krav) to fulfill these web accessibility standards.

If you decide to choose your own colors, you can test their accessibility using tools like [WAVE](https://wave.webaim.org/extension/) or [Colourblindly](https://chromewebstore.google.com/detail/colorblindly/floniaahmccleoclneebhhmnjgdfijgg?hl=en&pli=1).

### Configuration

Follow the same configuration steps as described above for the deployment of the default version.

### Building

Run 
``` sh
./compose-prod.sh build
```

### Startup
Run

``` sh
./compose-prod.sh up
```
This will run the project based on the local image you just built, using the custom colors.