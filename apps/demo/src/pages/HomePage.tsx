import { bind } from "@onlycells/core";
import { component } from "../cells";
import {
  CounterCard,
  FeatureList,
  PageHeader,
  SectionTitle,
  StatusMetric,
  ThemeCard,
} from "../components";
import { posts, session } from "../state";

export const HomePage = component("HomePage", (proxy) => {
  const authStatus = proxy.map([session], ({ status }) => status, "auth status", true);
  const postCount = proxy.map([posts], ({ data }) => data?.length ?? 0, "post count", true);

  return (
    <section class="page">
      <PageHeader hero title="TSX as browser syntax.">
        A lean rich-client framework that lives with your app: real DOM nodes, explicit store
        subscriptions, validated data, cache, auth, forms, and routing without React, axios, or a
        virtual DOM.
      </PageHeader>

      <SectionTitle title="Live app surface">
        Each panel is real DOM plus a small subscription, action, or binding. There is no component
        replay behind these updates.
      </SectionTitle>

      <div class="home-panels">
        <CounterCard />
        <section class="panel metrics">
          <StatusMetric
            label="Auth"
            value={authStatus}
            badge={proxy.map(
              [session],
              ({ token }) => (token ? "token" : "guest"),
              "auth badge",
              true,
            )}
            hint="Bearer-token helper"
            use={bind.class("tone-success", authStatus, (status) => status === "authenticated")}
          />
          <StatusMetric
            label="Posts"
            value={postCount}
            badge={proxy.map(
              [posts],
              ({ loading, status }) => (loading ? "loading" : status),
              "posts badge",
              true,
            )}
            hint={proxy.map(
              [posts],
              ({ stale }) =>
                stale ? "Stale cache visible while refreshing" : "Validated API data",
              "posts hint",
              true,
            )}
            use={bind.props(posts, ({ data, loading }) => ({
              title: `${data?.length ?? 0} parsed posts in memory`,
              class: { "tone-warning": loading },
            }))}
          />
        </section>
        <ThemeCard />
      </div>

      <SectionTitle title="Runtime map">
        The demo keeps the framework surface visible instead of hiding it behind app-specific
        wrappers.
      </SectionTitle>
      <section class="feature-panels">
        <FeatureList
          title="Framework surface"
          items={[
            "Direct DOM JSX runtime",
            "Lifecycle cleanup through actions",
            "Cell bindings for text, attributes, classes, and inputs",
            "Hash or history router",
          ]}
        />
        <FeatureList
          title="Data surface"
          items={[
            "Schema-based response validation",
            "Token auth headers and logout on 401",
            "localStorage cache with TTL and stale reads",
            "Resource state for loading, stale, error, success",
          ]}
        />
      </section>
    </section>
  );
});
