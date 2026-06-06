import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PostHogSpanProcessor } from "@posthog/ai/otel";
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";

const apiKey = process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (apiKey) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "refurb-genius-api",
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        apiKey,
        host: process.env.VITE_PUBLIC_POSTHOG_HOST || undefined,
      }),
    ],
    instrumentations: [new OpenAIInstrumentation()],
  });

  sdk.start();
}
