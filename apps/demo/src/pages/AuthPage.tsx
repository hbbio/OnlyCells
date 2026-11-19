import { type AuthToken, bind, Show, text, validatedSubmit } from "@nodiffjs/core";
import { component } from "../cells";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { LoginSchema } from "../schemas";
import { auth, demoCookieSessionRequest, fakeLogin, readDemoCsrfToken, session } from "../state";

const AuthOverview = component("AuthOverview", (proxy) => {
  const summary = proxy.map(
    [session],
    ({ user, status, token }) => ({
      userName: user?.name ?? "guest",
      tokenType: token?.tokenType ?? "Bearer",
      hasToken: token !== null,
      status,
    }),
    "session summary",
    true,
  );

  return (
    <section class="panel metrics">
      <StatusMetric
        label="Session"
        value={text(summary, (state) => state.userName)}
        badge={text(summary, (state) => state.status)}
        hint="Token state lives in a cell."
        use={bind.classes(summary, (state) => ({
          "tone-success": state.status === "authenticated",
        }))}
      />
      <StatusMetric
        label="Authorization"
        value={text(summary, (state) => state.tokenType)}
        badge={text(summary, (state) => (state.hasToken ? "ready" : "empty"))}
        hint="First-party requests read headers from this controller."
      />
    </section>
  );
});

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
  },
);

export const AuthPage = component("AuthPage", (proxy) => {
  const token = proxy.map([session], (state) => state.token, "active token", true);

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

      <Show store={token} when={(value) => value} fallback={() => <LoginPanel />}>
        {(value) => <AuthenticatedPanel token={value} />}
      </Show>
    </section>
  );
});
