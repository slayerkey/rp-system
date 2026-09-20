import streamDeck from "@elgato/streamdeck";

import { Countdown } from "./actions/countdown";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new Countdown());

await streamDeck.connect();
