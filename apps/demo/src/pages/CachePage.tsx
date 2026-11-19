import { text, view } from "@nodiffjs/core";
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
      <PageHeader title="Inspectable cache state." actions={<CacheActions refresh={refresh} />}>
        Preferences and HTTP snapshots share the same tiny cache format with expiry, tags, stale
        reads, and schema validation at read time.
      </PageHeader>

      <section class="panel metrics">
        <StatusMetric
          label="App cache"
          value={text(inventory, (state) => state.keys.length)}
          hint="Preferences snapshots."
        />
        <StatusMetric
          label="HTTP cache"
          value={text(inventory, (state) => state.httpCount)}
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
