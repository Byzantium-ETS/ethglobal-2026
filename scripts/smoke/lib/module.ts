import Module, { createRequire } from 'node:module';

const requireFromSmoke = createRequire(import.meta.url);

type Mocks = Record<string, unknown>;

export function loadFresh<T>(modulePath: string, mocks: Mocks = {}, purge: string[] = []): T {
  for (const target of [modulePath, ...purge]) {
    delete requireFromSmoke.cache[requireFromSmoke.resolve(target)];
  }

  const originalLoad = Module._load;
  Module._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (Object.keys(mocks).includes(request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  } as typeof Module._load;

  try {
    return requireFromSmoke(modulePath) as T;
  } finally {
    Module._load = originalLoad;
  }
}

export function requireActual<T>(moduleName: string): T {
  return requireFromSmoke(moduleName) as T;
}