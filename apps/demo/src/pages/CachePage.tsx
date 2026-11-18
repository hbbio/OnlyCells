import { view } from "@nodiffjs/core";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { apiCache, appCache, auth, cacheInspector, refreshCacheInspector } from "../state";

function CacheActions() {
  return (
    <div class="button-group">
      <button onClick={refreshCacheInspector}>Refresh list</button>
      <button
        class="button-primary"
        onClick={() => {
          appCache.clear();
          auth.logout();
          refreshCacheInspector();
        }}
      >
        Clear demo cache
      </button>
    </div>
  );
}

export function CachePage() {
  return (
    <section class="page">
      <PageHeader title="Inspectable cache state." actions={<CacheActions />}>
        Preferences and HTTP snapshots share the same tiny cache format with expiry, tags, stale
        reads, and zod validation at read time.
      </PageHeader>

      {view(
        cacheInspector,
        (state) => state.version,
        () => {
          const appKeys = appCache.keys();
          const httpKeys = apiCache.keys();
          return (
            <section class="panel metrics">
              <StatusMetric
                label="App cache"
                value={appKeys.length}
                hint="Preferences snapshots."
              />
              <StatusMetric
                label="HTTP cache"
                value={httpKeys.length}
                hint="GET response envelopes with tags and TTL."
              />
            </section>
          );
        },
      )}

      <SectionTitle title="Demo-prefixed keys">
        Remove individual entries to watch the app recover from parsed defaults or a fresh request.
      </SectionTitle>

      {view(
        cacheInspector,
        (state) => state.version,
        () => {
          const keys = appCache.keys().sort();
          if (keys.length === 0) return <p class="notice">No demo cache keys.</p>;

          return (
            <section class="panel">
              <ul class="cache-keys">
                {keys.map((key) => (
                  <li>
                    <code>demo:{key}</code>
                    <button
                      class="button-quiet"
                      onClick={() => {
                        appCache.remove(key);
                        refreshCacheInspector();
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        },
      )}
    </section>
  );
}
