import { view } from "@nodiffjs/core";
import { component } from "../cells";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { apiCache, appCache, auth } from "../state";

function readInventory() {
  return { keys: appCache.keys().sort(), httpCount: apiCache.keys().length };
}

const CacheActions = component("CacheActions", (_proxy, { refresh }: { refresh: () => void }) => {
  return (
    <div class="button-group">
      <button onClick={refresh}>Refresh list</button>
      <button
        class="button-primary"
        onClick={() => {
          appCache.clear();
          auth.logout();
          refresh();
        }}
      >
        Clear demo cache
      </button>
    </div>
  );
});

export const CachePage = component("CachePage", (proxy) => {
  const inventory = proxy.new(readInventory(), "cache inventory");
  const refresh = () => {
    inventory.set(readInventory());
  };

  return (
    <section class="page">
      <PageHeader title="Inspectable local storage." actions={<CacheActions refresh={refresh} />}>
        Cells save preferences. Cached HTTP responses have expiry, tags, stale reads, and schema
        validation.
      </PageHeader>

      <section class="panel metrics">
        <StatusMetric
          label="Demo storage"
          value={inventory.map(({ keys }) => keys.length, "storage keys", true)}
          hint="Preferences and cached responses."
        />
        <StatusMetric
          label="HTTP cache"
          value={inventory.map(({ httpCount }) => httpCount, "HTTP cache entries", true)}
          hint="GET response envelopes with tags and TTL."
        />
      </section>

      <SectionTitle title="Demo-prefixed keys">
        Remove individual entries to watch the app recover from parsed defaults or a fresh request.
      </SectionTitle>

      {view(
        inventory,
        (state) => state.keys,
        (keys) => {
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
                        refresh();
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
});
