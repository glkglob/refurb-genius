import { PostHog } from "posthog-node";

let posthogClient: PostHog | null = null;

export function getPostHogServerClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(
      process.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN ??
        (import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN as string),
      {
        host:
          process.env.VITE_PUBLIC_POSTHOG_HOST ??
          (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined),
        flushAt: 1,
        flushInterval: 0,
      },
    );
  }
  return posthogClient;
}
