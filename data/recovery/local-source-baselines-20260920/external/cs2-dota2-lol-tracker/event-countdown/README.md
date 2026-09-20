# Event Countdown

Beautiful, self-contained countdowns to any future date — one per key. No internet, no API,
just date math. Each countdown escalates as the moment approaches and celebrates when it lands.

## The action
**Countdown** — set an **event name**, a **date & time**, and how much detail to show
(days / days+hours / days+hours+minutes). The key then:

- shows a calm violet countdown normally,
- turns **amber** when the event is under **24 hours** away,
- **pulses red** when it's under **1 hour** away,
- throws **confetti** for 24 hours after it lands, then resets to a gentle "set a date" idle.

Add the action to as many keys as you want — each is fully independent (game launch, Christmas,
stream anniversary, a birthday…).

## Install
Double-click `distribution/event-countdown.streamDeckPlugin`, or in a dev checkout:

```bash
npm install
npm run build
streamdeck link com.ratpack.eventcountdown.sdPlugin
streamdeck restart com.ratpack.eventcountdown
```

## Preview the states quickly
The amber/red/celebrate states are time-gated, so this prints ready-to-paste date values that
drop you straight into each one:

```bash
node scripts/mock-countdown.mjs
```
Paste a printed value into the action's **Date & time** field to see that state immediately.
