import { view } from "@onlycells/core";
import { component } from "../cells";
import { PageHeader, SectionTitle, StatusMetric } from "../components";
import { httpCachePrefix, session } from "../state";

function readInventory() {
  try {
    const keys = Object.keys(localStorage)
      .filter((key) => key.startsWith("demo:"))
      .sort();
    return { keys, httpCount: keys.filter((key) => key.startsWith(httpCachePrefix)).length };
  } catch {
    return { keys: [], httpCount: 0 };
  }
}

function removeEntry(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage may be unavailable.
  }
}

const CacheActions = component("CacheActions", (_proxy, { refresh }: { refresh: () => void }) => {
  return (
    <div class="button-group">
      <button onClick={refresh}>Refresh list</button>
      <button
        class="button-primary"
        onClick={() => {
          for (const key of readInventory().keys) removeEntry(key);
          session.value?.clear();
          refresh();
        }}
      >
        Clear demo storage
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

      <SectionTitle title="Demo storage keys">
        Removing saved preferences restores the defaults on the next load.
      </SectionTitle>

      {view(
        inventory,
        (state) => state.keys,
        (keys) => {
          if (keys.length === 0) return <p class="notice">No saved demo entries.</p>;

          return (
            <section class="panel">
              <ul class="cache-keys">
                {keys.map((key) => (
                  <li>
                    <code>{key}</code>
                    <button
                      class="button-quiet"
                      onClick={() => {
                        removeEntry(key);
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
