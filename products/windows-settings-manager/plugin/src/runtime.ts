import { ModeStore } from "./store.js";
import { StateService } from "./state.js";
import type { Flavor } from "./types.js";

export const runtime = {
  flavor: "lite" as Flavor,
  state: new StateService(),
  store: new ModeStore()
};

export function configureRuntime(flavor: Flavor): void {
  runtime.flavor = flavor;
}
