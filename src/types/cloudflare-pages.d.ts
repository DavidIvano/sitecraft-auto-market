type PagesContext<Env = unknown> = {
  request: Request;
  env: Env;
  params: Record<string, string | string[] | undefined>;
  next: () => Promise<Response>;
  waitUntil?: (promise: Promise<unknown>) => void;
  data?: Record<string, unknown>;
  functionPath?: string;
};

type PagesFunction<Env = unknown> = (context: PagesContext<Env>) => Response | Promise<Response>;

type R2ObjectBody = {
  body: BodyInit;
  httpEtag: string;
  writeHttpMetadata: (headers: Headers) => void;
};

type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>;
};
