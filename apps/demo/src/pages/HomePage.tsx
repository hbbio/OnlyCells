import { bind, text } from "@nodiffjs/core";
import { component } from "../cells";
import {
  CounterCard,
  FeatureList,
  PageHeader,
  SectionTitle,
  StatusMetric,
  ThemeCard,
} from "../components";
import { postsState, session } from "../state";

export const HomePage = component("HomePage", (proxy) => {
  const authSummary = proxy.map(
    [session],
    ({ status, token }) => ({ status, hasToken: token !== null }),
    "auth summary",
    true,
  );
  const postSummary = proxy.map(
    [postsState],
    ({ data, status, stale, loading }) => ({ total: data?.length ?? 0, status, stale, loading }),
    "post summary",
    true,
  );

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
            value={text(authSummary, (state) => state.status)}
            badge={text(authSummary, (state) => (state.hasToken ? "token" : "guest"))}
            hint="Bearer-token helper"
            use={bind.classes(authSummary, (state) => ({
              "tone-success": state.status === "authenticated",
            }))}
          />
          <StatusMetric
            label="Posts"
            value={text(postSummary, (state) => state.total)}
            badge={text(postSummary, (state) => (state.loading ? "loading" : state.status))}
            hint={text(postSummary, (state) =>
              state.stale ? "Stale cache visible while refreshing" : "Validated API data",
            )}
            use={bind.props(postSummary, (state) => ({
              title: `${state.total} parsed posts in memory`,
              class: { "tone-warning": state.loading },
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
