// @sightspool/react — React bindings over @sightspool/sdk.
//
// A thin, correct wrapper: it adds no capture capability the core SDK lacks. What it
// buys you is the idiomatic React install — a declarative <SightspoolProvider> instead
// of a hand-written effect, identify() that tracks auth state, consent wired to React
// state, and SSR/StrictMode safety so the broken version is hard to write.
//
// The "use client" directive is added at build time (see tsup.config.ts) so the module
// drops straight into a Next.js App Router server component tree.

import {
  init as sdkInit,
  identify as sdkIdentify,
  consent as sdkConsent,
  start as sdkStart,
  stop as sdkStop,
  type SightspoolConfig,
  type Identity,
} from "@sightspool/sdk";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { toIdentifyArgs } from "./identity";

export type SightspoolApi = {
  identify: (userId: string, traits?: { account?: string; plan?: string }) => void;
  consent: (granted: boolean) => void;
  start: () => void;
  stop: () => void;
};

const api: SightspoolApi = {
  identify: sdkIdentify,
  consent: sdkConsent,
  start: sdkStart,
  stop: sdkStop,
};

const SightspoolContext = createContext<SightspoolApi>(api);

export type SightspoolProviderProps = {
  /** Publishable key (`pk_test_…` / `pk_live_…`). */
  apiKey: string;
  /**
   * Reactive identity — `identify()` fires whenever this changes. Pass `null`/`undefined`
   * while logged out (identify is skipped until there's a user id).
   */
  identity?: Identity | null;
  /**
   * Reactive consent gate (wire to a cookie banner). When provided, capture starts
   * **paused** and follows this value. Omit to use the SDK default (capture immediately).
   */
  consent?: boolean;
  /** The remaining init options (`endpoint`, `boundaryAsk`, `redact`, `block`, `captureOnLocalhost`, `debug`). */
  options?: Omit<SightspoolConfig, "key" | "consent">;
  children?: ReactNode;
};

/**
 * Boots the Sightspool SDK once and keeps `identity` + `consent` in sync with React
 * state. Drop it once near your app root.
 *
 * - **SSR-safe**: the SDK is client-only; init runs in an effect, never on the server.
 * - **StrictMode-safe**: init runs once (guarded here and idempotent in the SDK).
 * - It deliberately does **not** tear down the SDK on unmount — the SDK is a
 *   page-lifetime singleton, so a root provider unmount shouldn't stop capture.
 */
export function SightspoolProvider({
  apiKey,
  identity,
  consent,
  options,
  children,
}: SightspoolProviderProps) {
  const started = useRef(false);

  // Init once. apiKey/options are read at first mount; a key swap mid-session isn't a
  // real use case and the SDK's init is idempotent regardless.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sdkInit({
      key: apiKey,
      ...options,
      // If a consent prop drives us, start paused and let the consent effect apply it.
      ...(consent !== undefined ? { consent: false } : {}),
    });
    const args = toIdentifyArgs(identity);
    if (args) sdkIdentify(args.userId, args.traits);
    if (consent !== undefined) sdkConsent(consent);
    // Init-once: intentionally empty deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive identity.
  useEffect(() => {
    if (!started.current) return;
    const args = toIdentifyArgs(identity);
    if (args) sdkIdentify(args.userId, args.traits);
  }, [identity?.userId, identity?.account, identity?.plan]);

  // Reactive consent.
  useEffect(() => {
    if (!started.current || consent === undefined) return;
    sdkConsent(consent);
  }, [consent]);

  return <SightspoolContext.Provider value={api}>{children}</SightspoolContext.Provider>;
}

/** Access the SDK actions (`identify` / `consent` / `start` / `stop`) from any component under the provider. */
export function useSightspool(): SightspoolApi {
  return useContext(SightspoolContext);
}

/**
 * Keep identity in sync without the provider prop — re-identifies whenever `identity`
 * changes, and skips while logged out. Useful when your user object lives below the
 * provider (e.g. resolved by a hook in a feature component).
 */
export function useSightspoolIdentify(identity: Identity | null | undefined): void {
  useEffect(() => {
    const args = toIdentifyArgs(identity);
    if (args) sdkIdentify(args.userId, args.traits);
  }, [identity?.userId, identity?.account, identity?.plan]);
}

export type { Identity, SightspoolConfig } from "@sightspool/sdk";
