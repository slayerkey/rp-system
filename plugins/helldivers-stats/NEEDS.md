# Needs

- `registry.json` does not currently define a Packrat support email. The adapter therefore sends
  `https://marketplace.elgato.com/@packrat` as `X-Super-Contact`, which gives the community API a
  working contact route. Replace `SUPPORT_CONTACT` in `src/api.ts` when the owner supplies the
  intended support email.

