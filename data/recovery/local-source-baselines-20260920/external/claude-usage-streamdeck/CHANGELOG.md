# Changelog

This repo builds several Stream Deck products from one shared engine, so entries are
grouped by product rather than by date.

## Perplexity Usage

### 0.1.2.0

- Fixed support for Perplexity's current `__Secure-next-auth.session-token` cookie.
- Fixed valid Perplexity sessions incorrectly appearing expired or invalid.
- Added compatibility with current and legacy Perplexity session-cookie names.
- Updated connection instructions for Chrome, Edge, Firefox and Safari.

## AI Usage Tracker

### 1.0.1.0

- Copilot fix, same as the standalone Copilot key: work accounts on a company-managed
  licence, and Enterprise Managed User accounts, could only show Offline because none of
  the billing records being read exist for them. Their quota is now read directly.
- Copilot credit allowances now come from the account rather than a built-in table, so
  business accounts no longer show a percentage measured against the wrong number.

### 1.0.0.0

First release. Windows and macOS, every Stream Deck model.

- All eight services in one plugin: Claude, ChatGPT, Codex, Cursor, Gemini, Copilot, Grok and Perplexity.
- Pick the service per key, or put every one you track on a single rollup key.
- Eight display styles and three themes, available on every service.
- Named accounts per service, so work and personal stay separate.
- A service that stops answering shows a dash on its own key and its own rollup row. The other seven keep reading normally.

## Codex Usage

### 0.1.3.0

- Fixed: pasting the session cookie, which the setup notes recommend for a login that
  lasts, always came back as "Expired". The plugin could not tell the cookie apart from
  the shorter-lived access token and tried to use it as one, which can only ever fail.
  Both now work, so a key set up with the cookie stops asking you to re-paste it every
  few days.

## ChatGPT Usage

### 0.1.6.0

- Fixed: the Credits key read "no credits on this plan" for everyone, including accounts
  with a balance sitting right there. Credits are a balance rather than a percentage, and
  the key was trying to work out what share of a total had been spent. No total is ever
  sent, so it gave up and showed the not-available face. The key now shows the balance
  itself, on every style and theme.
- An account with unlimited credits shows that instead of a number.
- The Credits key can no longer say anything about what your plan includes. If the balance
  cannot be read it says only that, because it cannot tell an account without credits apart
  from one it does not recognise.

### 0.1.5.0

- Fixed: pasting the session cookie, which the setup notes recommend for a login that
  lasts, always came back as "Expired". The plugin could not tell the cookie apart from
  the shorter-lived access token and tried to use it as one, which can only ever fail.
  Both now work, so a key set up with the cookie stops asking you to re-paste it every
  few days.

### 0.1.4.0

- New Credits window. Pick it under Window to give a key your ChatGPT credit balance,
  alongside the 5-hour and weekly keys you already have. Turn on "show remaining" if you
  would rather read what is left than what is spent.
- Accounts with no credit balance show "no credits on this plan" rather than an error.

## Claude Usage

### 0.1.3.0

- Light theme fix: on the Ring style, the reset time under the dial was drawn white on a
  white background and could not be read. It now uses the theme's secondary text colour.

### 0.1.2.0

- Adds the model-specific weekly window, so Max plans can watch the premium model cap
  on its own key.
- Token handling fix shared with the ChatGPT and Codex builds: the account id header is
  sent, long-lived session cookies are accepted, and usage parsing was corrected.

## Copilot Usage

### 0.2.1.0

- Fixes work accounts that could still only show Offline. On a company-managed Copilot
  licence, and on any Enterprise Managed User account, none of the billing records the key
  was reading exist, so every one of them came back empty. It now reads your quota directly
  when that happens.
- Your credit allowance now comes from your account rather than from a built-in table of
  published figures. Business accounts in particular were being measured against the wrong
  number, so the percentage shown could be far too high.
- When your token is not authorised for an organization, the log now says so, and says that
  the fix is authorising the existing token rather than creating a new one.

### 0.2.0.0

- Adds support for Copilot provided through an employer. Company licences record their AI
  credits against the organization instead of against you, so the key could only ever show
  Offline on a work account. It now reads the organization's record when your own has
  nothing in it, and counts only your own usage from it.
- New BUSINESS and ENTERPRISE options in the Type dropdown, with the credit allowances
  those plans come with.
- Setup notes now cover work accounts: the extra permission the token needs, and the
  single sign-on step that otherwise hides the organization from it.
- When usage still cannot be read, the plugin log now names every address it tried and what
  each one answered, so a support message can be settled in one reply instead of several.
