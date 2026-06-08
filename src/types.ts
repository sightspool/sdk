// Public + internal types for the Sightspool capture runtime.

export type SightspoolConfig = {
  /** Publishable key (pk_live_…) from the Connections → In-product SDK card. */
  key: string;
  /** Ingest base URL. Defaults to the Sightspool app; override for self-host/dev. */
  endpoint?: string;
  /** Show the one-tap boundary ask ("did you do what you came to do?"). Default true. */
  boundaryAsk?: boolean;
  /** Show human-approved interventions (surveys) served by /api/sdk/serve. Default true. */
  interventions?: boolean;
  /** Start capturing immediately. Set false to wait for start() after consent. Default true. */
  consent?: boolean;
  /** CSS selectors whose text is masked (replaced with a placeholder) before capture. */
  redact?: string[];
  /** CSS selectors whose events are dropped entirely (the hard opt-out; same as `data-sightspool-ignore`). */
  block?: string[];
  /** Capture from localhost too. Default false — dev traffic is suppressed so it can't pollute analytics. */
  captureOnLocalhost?: boolean;
  /** Log capture decisions to the console. Default false. */
  debug?: boolean;
};

export type Identity = {
  userId?: string;
  account?: string;
  plan?: string;
};

export type SignalAnswer = "yes" | "not_really" | "dismissed";

export type TrailEventType =
  | "route"
  | "click"
  | "dead_click"
  | "rage_click"
  | "input"
  | "search"
  | "zero_result"
  | "error"
  | "request_error";

/** One buffered event in the rolling trail. */
export type TrailEvent = {
  t: number; // epoch ms
  type: TrailEventType;
  label?: string; // route, button text, query, error — redacted before storing
};

/**
 * The wire payload the SDK POSTs to /api/sdk/ingest. The server maps this to a
 * sightspool.signals row; intent/effort stay uninferred (the inference pass fills
 * them). A flat, minimal contract — the SDK and server each keep their own copy of
 * this type; the SDK never imports server code.
 */
export type CapturedSignal = {
  captured_at: string; // ISO
  route?: string;
  client_label?: string;
  answer?: SignalAnswer;
  verbatim?: string; // free-text from "something else", redacted
  intent_hint?: string; // locally-harvested stated intent (e.g. a search query)
  outcome?: "achieved" | "failed" | "unknown";
  error?: string;
  trail: TrailEvent[];
  session_ref: string;
  trigger: "boundary" | "friction";
};

export type IngestBody = {
  key: string;
  identity?: Identity;
  signals: CapturedSignal[];
};
