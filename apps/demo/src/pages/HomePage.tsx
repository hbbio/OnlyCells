import { bind, text } from "@nodiffjs/core";
import {
  CounterCard,
  FeatureList,
  PageHeader,
  SectionTitle,
  StatusMetric,
  ThemeCard,
} from "../components";
import { auth, postsVm } from "../state";

export function HomePage() {
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
            value={text(auth.store, (state) => state.status)}
            badge={text(auth.store, (state) => (state.token ? "token" : "guest"))}
            hint="Bearer-token helper"
            use={bind.classes(auth.store, (state) => ({
              "tone-success": state.status === "authenticated",
            }))}
          />
          <StatusMetric
            label="Posts"
            value={text(postsVm, (state) => state.total)}
            badge={text(postsVm, (state) => (state.loading ? "loading" : state.status))}
            hint={text(postsVm, (state) =>
              state.stale ? "Stale cache visible while refreshing" : "Validated API data",
            )}
            use={bind.props(postsVm, (state) => ({
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
            "Store bindings for text, attrs, classes, inputs",
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
}
