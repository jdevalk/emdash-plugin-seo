import { describe, expect, it, vi } from "vitest";
import { PluginRouteError } from "emdash";
import type { RouteContext } from "emdash";

import { createPlugin } from "../src/index.js";

interface AnonymousRouteResponse {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  status?: number;
}

interface PublicRouteRuntime {
  getPluginRouteMeta(pluginId: string, path: string): { public: boolean } | null;
  handlePluginApiRoute(
    pluginId: string,
    method: string,
    path: string,
    request: Request,
  ): Promise<AnonymousRouteResponse>;
}

type PublicRouteHandler = (
  pluginId: string,
  method: string,
  path: string,
  request: Request,
) => Promise<AnonymousRouteResponse>;

type CreatePublicRouteHandler = (runtime: PublicRouteRuntime) => PublicRouteHandler;

function isPublicRouteModule(value: unknown): value is {
  createPublicPluginApiRouteHandler: CreatePublicRouteHandler;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "createPublicPluginApiRouteHandler" in value &&
    typeof value.createPublicPluginApiRouteHandler === "function"
  );
}

const publicRouteModulePath = "../node_modules/emdash/src/astro/public-plugin-api-routes.js";
const publicRouteModule: unknown = await import(/* @vite-ignore */ publicRouteModulePath);
if (!isPublicRouteModule(publicRouteModule)) {
  throw new Error("EmDash public plugin route handler is unavailable");
}
const { createPublicPluginApiRouteHandler } = publicRouteModule;

function createAnonymousDispatcher() {
  const plugin = createPlugin();
  const store = new Map<string, unknown>();
  const kv = {
    get: vi.fn(async (key: string) => store.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => store.delete(key)),
    list: vi.fn(async (prefix?: string) =>
      Array.from(store.entries())
        .filter(([key]) => !prefix || key.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
    ),
  };
  const dispatch = vi.fn(async (_pluginId: string, _method: string, path: string, request: Request) => {
    const route = plugin.routes[path.replace(/^\//, "")];
    if (!route) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "Plugin route not found" },
      };
    }

    try {
      const data = await route.handler({ request, kv } as unknown as RouteContext);
      return { success: true, data };
    } catch (error) {
      if (error instanceof PluginRouteError) {
        return {
          success: false,
          error: { code: error.code, message: error.message },
          status: error.status,
        };
      }
      throw error;
    }
  });
  const handler = createPublicPluginApiRouteHandler({
    getPluginRouteMeta(pluginId, path) {
      const route = pluginId === plugin.id ? plugin.routes[path.replace(/^\//, "")] : undefined;
      return route ? { public: route.public === true } : null;
    },
    handlePluginApiRoute: dispatch,
  });

  return { dispatch, handler, kv, plugin };
}

const publishedFileRoutes = ["indexnow/key", "llms/txt"] as const;
const nonGetMethods = ["POST", "PUT", "PATCH", "DELETE"] as const;

describe("published-file route access", () => {
  it.each(publishedFileRoutes)("allows anonymous GET access to %s", async (path) => {
    const { dispatch, handler } = createAnonymousDispatcher();
    const request = new Request(`https://example.com/${path}`);

    await expect(handler("seo", "GET", path, request)).resolves.toMatchObject({
      success: true,
    });
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it.each(
    publishedFileRoutes.flatMap((path) => nonGetMethods.map((method) => [method, path] as const)),
  )("rejects anonymous %s access to %s before route side effects", async (method, path) => {
    const { dispatch, handler, kv } = createAnonymousDispatcher();
    const request = new Request(`https://example.com/${path}`, { method });

    await expect(handler("seo", method, path, request)).resolves.toMatchObject({
      success: false,
      error: { code: "METHOD_NOT_ALLOWED" },
      status: 405,
    });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(kv.get).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
    expect(kv.list).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "settings"],
    ["POST", "settings/save"],
  ])("keeps %s %s protected", async (method, path) => {
    const { dispatch, handler } = createAnonymousDispatcher();
    const request = new Request(`https://example.com/${path}`);

    await expect(handler("seo", method, path, request)).resolves.toMatchObject({
      success: false,
      error: { code: "NOT_FOUND" },
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not broaden public access beyond published read routes", () => {
    const { plugin } = createAnonymousDispatcher();
    const publicRoutes = Object.entries(plugin.routes)
      .filter(([, route]) => route.public === true)
      .map(([path]) => path)
      .sort();

    expect(publicRoutes).toEqual(["indexnow/key", "llms/txt", "schema/map"]);
  });
});
