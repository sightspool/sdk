import Justusability, { type JustusabilityConfig } from "@justusability/sdk";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { researchUserId, type Identity } from "./identity";

const Context = createContext(Justusability);
export type JustusabilityProviderProps = {
  apiKey: string;
  audience: JustusabilityConfig["audience"];
  endpoint?: string;
  identity?: Identity | null;
  /** Controls recruitment visibility, not participant recording consent. */
  enabled?: boolean;
  children?: ReactNode;
};

/** Mount once on the pages included in the research audience. Cleanup stops recruitment. */
export function JustusabilityProvider({ apiKey, audience, endpoint, identity, enabled = true, children }: JustusabilityProviderProps) {
  const userId = researchUserId(identity);
  useEffect(() => {
    if (!enabled) return;
    Justusability.init({ key: apiKey, endpoint, audience });
    return () => Justusability.destroy();
  }, [apiKey, endpoint, audience, enabled]);
  useEffect(() => {
    Justusability.identify(userId);
    if (enabled) Justusability.resume();
    else Justusability.pause();
  }, [apiKey, endpoint, audience, userId, enabled]);
  return <Context.Provider value={Justusability}>{children}</Context.Provider>;
}

export function useJustusability() { return useContext(Context); }
export function useJustusabilityIdentify(identity: Identity | null | undefined) {
  const userId = researchUserId(identity);
  useEffect(() => { Justusability.identify(userId); }, [userId]);
}
export type { Identity, JustusabilityConfig };
