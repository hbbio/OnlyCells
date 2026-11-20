import { bind, type Action, type Child } from "@onlycells/core";
import { component } from "./cells";
import { count, step, theme, type Theme, themeOptions } from "./preferences";

export const PageHeader = component(
  "PageHeader",
  (
    _proxy,
    props: {
      title: string;
      children: Child;
      actions?: Child;
      hero?: boolean;
    },
  ) => {
    return (
      <header class={props.hero ? "page-header page-hero" : "page-header panel"}>
        <div class="page-intro">
          <h1>{props.title}</h1>
          <p>{props.children}</p>
        </div>
        {props.actions}
      </header>
    );
  },
);

export const Badge = component(
  "Badge",
  (
    _proxy,
    props: {
      children?: Child;
      tone?: "neutral" | "success" | "warning" | "danger";
      use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
    },
  ) => {
    return (
      <span class="badge" data-tone={props.tone} use={props.use}>
        {props.children}
      </span>
    );
  },
);

export const SectionTitle = component(
  "SectionTitle",
  (_proxy, props: { title: string; children?: Child; actions?: Child }) => {
    return (
      <div class="section-title">
        <div>
          <h2>{props.title}</h2>
          {props.children ? <p>{props.children}</p> : null}
        </div>
        {props.actions}
      </div>
    );
  },
);

export const CounterCard = component("CounterCard", () => {
  return (
    <article class="panel counter-card" aria-live="polite">
      <div class="panel-heading">
        <div>
          <h2 class="panel-label">Counter</h2>
          <strong class="counter-value">{count}</strong>
        </div>
        <Badge>localStorage</Badge>
      </div>

      <div class="button-group">
        <button
          class="button-primary"
          onClick={() => count.update((value) => value + (step.value ?? 1))}
        >
          Increment
        </button>
        <button onClick={() => count.set(0)}>Reset</button>
      </div>

      <label class="field">
        Step
        <input
          type="number"
          min="1"
          max="10"
          use={bind.number(
            step,
            (value) => value,
            (value) => Math.max(1, Math.min(10, Math.trunc(value ?? 1))),
          )}
        />
      </label>
    </article>
  );
});

export const ThemeCard = component("ThemeCard", () => {
  const previews = ["cupcake", "synthwave", "nord", "sunset"] as const;

  return (
    <article class="panel">
      <h2 class="panel-label">Appearance</h2>
      <label class="field">
        Theme
        <select
          use={bind.prop("value", theme)}
          onChange={(event) => {
            const next = themeOptions.find((value) => value === event.currentTarget.value);
            if (next !== undefined) theme.set(next);
          }}
        >
          {themeOptions.map((theme) => (
            <option value={theme}>{themeLabel(theme)}</option>
          ))}
        </select>
      </label>

      <div class="theme-previews" role="group" aria-label="Theme previews">
        {previews.map((preview) => (
          <button
            type="button"
            data-theme={preview}
            class="theme-swatch"
            aria-label={themeLabel(preview)}
            use={bind.aria("pressed", theme, (current) => String(current === preview))}
            onClick={() => theme.set(preview)}
          />
        ))}
      </div>
    </article>
  );
});

function themeLabel(theme: Theme): string {
  if (theme === "system") return "System";
  return theme
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const StatusMetric = component(
  "StatusMetric",
  (
    _proxy,
    props: {
      label: string;
      value: Child;
      badge?: Child;
      hint: Child;
      use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
    },
  ) => {
    return (
      <div class="metric" use={props.use}>
        <div class="panel-heading">
          <div class="panel-label">{props.label}</div>
          {props.badge === undefined ? null : <Badge>{props.badge}</Badge>}
        </div>
        <strong class="metric-value">{props.value}</strong>
        <p class="metric-hint">{props.hint}</p>
      </div>
    );
  },
);

export const FeatureList = component(
  "FeatureList",
  (_proxy, props: { title: string; items: string[]; use?: Action<HTMLElement> }) => {
    return (
      <article class="panel" use={props.use}>
        <h3>{props.title}</h3>
        <ul class="feature-list">
          {props.items.map((item) => (
            <li>{item}</li>
          ))}
        </ul>
      </article>
    );
  },
);
