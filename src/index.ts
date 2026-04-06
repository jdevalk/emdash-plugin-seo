import { definePlugin } from "emdash";
import type { PluginDescriptor, RouteContext } from "emdash";
import { metadataHandler } from "./metadata.js";

export function seoPlugin(): PluginDescriptor {
  return {
    id: "seo",
    version: "0.1.3",
    format: "native",
    entrypoint: new URL("./index.ts", import.meta.url).pathname,
    adminEntry: new URL("./admin.tsx", import.meta.url).pathname,
    adminPages: [
      { path: "/settings", label: "SEO", icon: "settings" },
    ],
    options: {},
  };
}

export function createPlugin() {
  return definePlugin({
    id: "seo",
    version: "0.1.3",
    capabilities: ["read:content", "page:inject"],

    hooks: {
      "page:metadata": {
        handler: metadataHandler,
        priority: 10,
      },
    },

    routes: {
      "settings": {
        handler: async (ctx: RouteContext) => {
          const entries = await ctx.kv.list("settings:");
          const settings: Record<string, string> = {};
          for (const { key, value } of entries) {
            const k = key.replace("settings:", "");
            settings[k] = typeof value === "string" ? value : String(value);
          }
          return { settings };
        },
      },
      "settings/save": {
        handler: async (ctx: RouteContext) => {
          const { settings } = ctx.input as { settings: Record<string, string> };
          for (const [key, value] of Object.entries(settings)) {
            await ctx.kv.set(`settings:${key}`, value);
          }
          return { ok: true };
        },
      },
    },

    admin: {
      pages: [
        { path: "/settings", label: "SEO", icon: "settings" },
      ],
    },
  });
}

export default createPlugin;
