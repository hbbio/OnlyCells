import { bind, Show, text, validatedSubmit } from "@nodiffjs/core";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { LoginSchema } from "../schemas";
import { auth, demoCookieSessionRequest, fakeLogin, readDemoCsrfToken } from "../state";

function AuthOverview() {
  return (
    <section class="panel metrics">
      <StatusMetric
        label="Session"
        value={text(auth.store, (state) => state.user?.name ?? "guest")}
        badge={text(auth.store, (state) => state.status)}
        hint="Token state lives in a cell."
        use={bind.classes(auth.store, (state) => ({
          "tone-success": state.status === "authenticated",
        }))}
      />
      <StatusMetric
        label="Authorization"
        value={text(auth.store, (state) => state.token?.tokenType ?? "Bearer")}
        badge={text(auth.store, (state) => (state.token ? "ready" : "empty"))}
        hint="First-party requests read headers from this controller."
      />
    </section>
  );
}

function LoginPanel() {
  return (
    <form
      use={validatedSubmit(LoginSchema, fakeLogin, {
        csrf: {
          getToken: readDemoCsrfToken,
          required: true,
        },
      })}
    >
      <fieldset class="panel control-group">
        <legend>Login</legend>
        <label class="field">
          Email
          <input name="email" type="email" value="demo@example.com" autocomplete="email" />
        </label>
        <label class="field">
          Password
          <input name="password" type="password" value="demo" autocomplete="current-password" />
        </label>
        <button class="button-primary" type="submit">
          Create demo token
        </button>
      </fieldset>
    </form>
  );
}

function AuthenticatedPanel() {
  const token = auth.store.getState().token;
  const tokenPreview = token?.accessToken ? `${token.accessToken.slice(0, 18)}...` : "none";
  const expiresAt = token?.expiresAt ? new Date(token.expiresAt).toLocaleString() : "session";

  return (
    <section class="panel">
      <div class="panel-heading">
        <div>
          <h2>Authenticated</h2>
          <p class="metric-hint">Token preview: {tokenPreview}</p>
          <p class="metric-hint">Expires: {expiresAt}</p>
        </div>
        <button onClick={() => auth.logout()}>Logout</button>
      </div>
      <pre class="code-block">
        <code>
          {JSON.stringify(
            {
              headers: auth.authHeaders(),
              cookieSession: demoCookieSessionRequest,
            },
            null,
            2,
          )}
        </code>
      </pre>
    </section>
  );
}

export function AuthPage() {
  return (
    <section class="page">
      <PageHeader title="Bearer headers without ceremony.">
        A tiny controller keeps a token in memory, exposes auth headers for first-party requests,
        and lets the app keep ownership of login and refresh policy.
      </PageHeader>

      <AuthOverview />

      <SectionTitle title="Auth branch">
        Show swaps the login form and token panel from the auth store.
      </SectionTitle>

      <Show store={auth.store} when={(state) => state.token} fallback={() => <LoginPanel />}>
        {() => <AuthenticatedPanel />}
      </Show>
    </section>
  );
}
