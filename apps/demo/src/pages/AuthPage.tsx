import { type AuthToken, bind, cookieSessionRequest, Show, validatedSubmit } from "@nodiffjs/core";
import { component } from "../cells";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { LoginSchema, type LoginValues } from "../schemas";
import { authHeaders, readDemoCsrfToken, session } from "../state";

const AuthOverview = component("AuthOverview", (proxy) => {
  const status = proxy.map([session], (state) => state.status, "session status", true);

  return (
    <section class="panel metrics">
      <StatusMetric
        label="Session"
        value={proxy.map([session], ({ user }) => user?.name ?? "guest", "session user", true)}
        badge={status}
        hint="Token state lives in a cell."
        use={bind.class("tone-success", status, (value) => value === "authenticated")}
      />
      <StatusMetric
        label="Authorization"
        value={proxy.map(
          [session],
          ({ token }) => token?.tokenType ?? "Bearer",
          "token type",
          true,
        )}
        badge={proxy.map(
          [session],
          ({ token }) => (token ? "ready" : "empty"),
          "token badge",
          true,
        )}
        hint="First-party requests read headers from this controller."
      />
    </section>
  );
});

function fakeLogin({ email }: LoginValues): void {
  const issuedAt = Date.now();
  const name = email.split("@")[0] || "demo-user";
  session.value?.setToken(
    {
      accessToken: btoa(`${email}:${issuedAt}`),
      expiresAt: issuedAt + 60 * 60 * 1000,
    },
    { email, name },
  );
}

const LoginPanel = component("LoginPanel", () => {
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
});

const AuthenticatedPanel = component(
  "AuthenticatedPanel",
  (_proxy, { token }: { token: AuthToken }) => {
    const tokenPreview = token.accessToken ? `${token.accessToken.slice(0, 18)}...` : "none";
    const expiresAt = token.expiresAt ? new Date(token.expiresAt).toLocaleString() : "session";

    return (
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Authenticated</h2>
            <p class="metric-hint">Token preview: {tokenPreview}</p>
            <p class="metric-hint">Expires: {expiresAt}</p>
          </div>
          <button onClick={() => session.value?.clear()}>Logout</button>
        </div>
        <pre class="code-block">
          <code>
            {JSON.stringify(
              {
                headers: authHeaders(),
                cookieSession: cookieSessionRequest(),
              },
              null,
              2,
            )}
          </code>
        </pre>
      </section>
    );
  },
);

export const AuthPage = component("AuthPage", () => {
  return (
    <section class="page">
      <PageHeader title="Bearer headers without ceremony.">
        A tiny controller keeps a token in memory, exposes auth headers for first-party requests,
        and lets the app keep ownership of login and refresh policy.
      </PageHeader>

      <AuthOverview />

      <SectionTitle title="Auth branch">
        Show swaps the login form and token panel as the session cell changes.
      </SectionTitle>

      <Show store={session} when={({ token }) => token} fallback={() => <LoginPanel />}>
        {(value) => <AuthenticatedPanel token={value} />}
      </Show>
    </section>
  );
});
