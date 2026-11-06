import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

try {
  const loaderCode = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers" || specifier.startsWith("cloudflare:")) {
    return {
      shortCircuit: true,
      url: "data:text/javascript," + encodeURIComponent("export const env = {}; export default { env: {} };")
    };
  }
  return nextResolve(specifier, context);
}
`;
  register("data:text/javascript," + encodeURIComponent(loaderCode), pathToFileURL("./"));
} catch {}

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});
