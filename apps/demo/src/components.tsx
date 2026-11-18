import { bind, text, type Action, type Child } from "@nodiffjs/core";
import { preferences, themeOptions, type PreferencesData } from "./state";

export function PageHeader(props: {
  title: string;
  children: Child;
  actions?: Child;
  hero?: boolean;
}) {
  return (
    <header class={props.hero ? "page-header page-hero" : "page-header panel"}>
      <div class="page-intro">
        <h1>{props.title}</h1>
        <p>{props.children}</p>
      </div>
      {props.actions}
    </header>
  );
}

export function Badge(props: {
  children?: Child;
  tone?: "neutral" | "success" | "warning" | "danger";
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
  return (
    <span class="badge" data-tone={props.tone} use={props.use}>
      {props.children}
    </span>
  );
}

export function SectionTitle(props: { title: string; children?: Child; actions?: Child }) {
  return (
    <div class="section-title">
      <div>
        <h2>{props.title}</h2>
        {props.children ? <p>{props.children}</p> : null}
      </div>
      {props.actions}
    </div>
  );
}

export function CounterCard() {
  return (
    <article
      class="panel counter-card"
      use={[
        bind.dataset("step", preferences, (state) => state.step),
        bind.aria("live", preferences, () => "polite"),
      ]}
    >
      <div class="panel-heading">
        <div>
          <h2 class="panel-label">Counter</h2>
          <strong class="counter-value">{text(preferences, (state) => state.count)}</strong>
        </div>
        <Badge>localStorage</Badge>
      </div>

      <div class="button-group">
        <button class="button-primary" onClick={() => preferences.getState().increment()}>
          Increment
        </button>
        <button onClick={() => preferences.getState().resetCount()}>Reset</button>
      </div>

      <label class="field">
        Step
        <input
          type="number"
          min="1"
          max="10"
          use={bind.number(
            preferences,
            (state) => state.step,
            (step) => ({
              step: Math.max(1, Math.min(10, Math.trunc(step ?? 1))),
            }),
          )}
        />
      </label>
    </article>
  );
}

export function ThemeCard() {
  const previews = ["cupcake", "synthwave", "nord", "sunset"] as const;

  return (
    <article class="panel">
      <h2 class="panel-label">Appearance</h2>
      <label class="field">
        Theme
        <select
          use={bind.prop("value", preferences, (state) => state.theme)}
          onChange={(event) => {
            const theme = themeOptions.find((value) => value === event.currentTarget.value);
            if (theme !== undefined) preferences.getState().setTheme(theme);
          }}
        >
          {themeOptions.map((theme) => (
            <option value={theme}>{themeLabel(theme)}</option>
          ))}
        </select>
      </label>

      <div class="theme-previews" aria-hidden="true">
        {previews.map((theme) => (
          <div data-theme={theme} class="theme-swatch" />
        ))}
      </div>
    </article>
  );
}

function themeLabel(theme: PreferencesData["theme"]): string {
  if (theme === "system") return "System";
  return theme
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusMetric(props: {
  label: string;
  value: Child;
  badge?: Child;
  hint: Child;
  use?: Action<HTMLElement> | Array<Action<HTMLElement>>;
}) {
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
}

export function FeatureList(props: { title: string; items: string[]; use?: Action<HTMLElement> }) {
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
}
