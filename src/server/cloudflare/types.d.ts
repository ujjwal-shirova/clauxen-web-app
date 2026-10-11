import type * as CF from "@cloudflare/workers-types";

declare global {
  type KVNamespace = CF.KVNamespace;
  type R2Bucket = CF.R2Bucket;
  type Hyperdrive = CF.Hyperdrive;
  type Queue<T = unknown> = CF.Queue<T>;
  type ImagesBinding = CF.ImagesBinding;
  type Fetcher = CF.Fetcher;
  type Service<T = unknown> = CF.Service<T>;
  type ExecutionContext = CF.ExecutionContext;
  type IncomingRequestCfProperties = CF.IncomingRequestCfProperties;
  type ExportedHandler<E = unknown, M = unknown> = CF.ExportedHandler<E, M>;
}
