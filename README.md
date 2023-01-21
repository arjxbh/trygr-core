# trygr-core
home automation data privacy experimentation

## ring api key required

from: https://github.com/dgreif/ring/wiki/Refresh-Tokens#refresh-token-expiration

Refresh Tokens
Jordi Rossell edited this page on Jan 25 · 6 revisions
Pages 11

Home
Apple TV Notifications
Camera Troubleshooting
Data Discovery
FFmpeg
NGHTTP2_ENHANCE_YOUR_CALM Error
Refresh Tokens

    The Easy Route
    If you have homebridge-ring installed globally
    If you do not have homebridge-ring installed globally
    Refresh Token Expiration

Ring UI Plugin Not Moving to Validation Step
SIP Communication
Snapshot Limitations

    Upgrading from v3 to v4

Add a custom sidebar
Clone this wiki locally

Ring now requires the use of Two-Factor Auth (2fa) for all accounts. If you have not turned on text-based 2fa, you will receive a verification code via email instead. For automation purposes (like homebridge-ring and ring-client-api) we need a special refreshToken that can be used long-term with 2fa turned on. A refreshToken allows us to bypass email/password/2fa altogether. To get a refreshToken, run one of the following commands on any computer with node installed:
The Easy Route

    Install homebridge-config-ui-x, which will give you a UI through which you can enter your Ring credentials to get logged in. No command line required ✨

If you have homebridge-ring installed globally

    Simply run ring-auth-cli from a terminal. It should be available globally via your npm bin directory.

If you do not have homebridge-ring installed globally

    npx -p ring-client-api ring-auth-cli

After entering your information, you will see a refreshToken in the output. Copy the token and open up your config file for homebridge or whatever platform is using ring-client-api. Remove your email and password values as these will no longer be used, and add "refreshToken": "TOKEN FROM COMMAND ABOVE". Restart your home automation app (homebridge, etc.) and Ring should authenticate successfully.

Note: Your refreshToken is just as valuable as an email/password so treat it with the same care you would a password. It can also be used for accounts that do not have 2fa enabled if you don't want your email/password in plain text in a config file.
Refresh Token Expiration

Ring has updated their refresh tokens so that they expire within a couple minutes of when they are used for the first time. This means that you basically only get to use a refresh token once, and need to keep the new refresh token that comes with the response.

For libraries that use ring-client-api, you can subscribe to api.onRefreshTokenUpdated to get the new refresh token each time a new one is created. This new refresh token should be stored wherever your library stores its configuration. See here for an example. If you are a user of homebridge-ring, this is done automatically for you, and your config.json will always be up-to-date with the last available refresh token.

