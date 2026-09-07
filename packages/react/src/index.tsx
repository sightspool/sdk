import Sightspool, { type SightspoolConfig } from "@sightspool/sdk";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { researchUserId, type Identity } from "./identity";

const Context = createContext(Sightspool);
export type SightspoolProviderProps = {
  apiKey: string;
  audience: SightspoolConfig["audience"];
  endpoint?: string;
  identity?: Identity | null;
  /** Controls recruitment visibility, not participant recording consent. */
  enabled?: boolean;
  children?: ReactNode;
};

/** Mount once on the pages included in the research audience. Cleanup stops recruitment. */
export function SightspoolProvider({ apiKey, audience, endpoint, identity, enabled = true, children }: SightspoolProviderProps) {
  const userId = researchUserId(identity);
  useEffect(() => {
    if (!enabled) return;
    Sightspool.init({ key: apiKey, endpoint, audience });
    return () => Sightspool.destroy();
  }, [apiKey, endpoint, audience, enabled]);
  useEffect(() => {
    Sightspool.identify(userId);
    if (enabled) Sightspool.resume();
    else Sightspool.pause();
  }, [apiKey, endpoint, audience, userId, enabled]);
  return <Context.Provider value={Sightspool}>{children}</Context.Provider>;
}

export function useSightspool() { return useContext(Context); }
export function useSightspoolIdentify(identity: Identity | null | undefined) {
  const userId = researchUserId(identity);
  useEffect(() => { Sightspool.identify(userId); }, [userId]);
}
export type { Identity, SightspoolConfig };
