import streamDeck from "@elgato/streamdeck";

import { IssOverhead, type IssGlobal } from "./actions/iss";
import { NextLaunch } from "./actions/launch";
import { Apod } from "./actions/apod";

streamDeck.logger.setLevel("info");

const iss = new IssOverhead();
streamDeck.actions.registerAction(iss);
streamDeck.actions.registerAction(new NextLaunch());
streamDeck.actions.registerAction(new Apod());

// Home coordinates / range are global (shared by every ISS key). Apply them on connect and on change.
streamDeck.settings.onDidReceiveGlobalSettings<IssGlobal>((ev) => iss.setHome(ev.settings));

await streamDeck.connect();
iss.setHome(await streamDeck.settings.getGlobalSettings<IssGlobal>());
