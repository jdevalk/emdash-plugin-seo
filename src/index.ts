import { definePlugin } from "emdash";
import type { PluginDescriptor } from "emdash";
import { metadataHandler } from "./metadata.js";
import { settingsSchema } from "./settings.js";

export function seoPlugin(): PluginDescriptor {
  return {
    id: "seo",
    version: "1.0.0",
    format: "native",
    entrypoint: new URL("./index.ts", import.meta.url).pathname,
    options: {},
  };
}

export function createPlugin() {
  return definePlugin({
    id: "seo",
    version: "1.0.0",
    capabilities: ["read:content"],

    hooks: {
      "page:metadata": {
        handler: metadataHandler,
        priority: 10,
      },
    },

    admin: {
      settingsSchema,
    },
  });
}

export default createPlugin;
