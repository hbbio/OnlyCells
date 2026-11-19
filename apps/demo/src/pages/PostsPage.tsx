import {
  bind,
  For,
  type ReadableCell,
  ResourceView,
  safeErrorMessage,
  text,
  view,
  when,
} from "@nodiffjs/core";
import { component } from "../cells";
import { Badge, PageHeader, SectionTitle } from "../components";
import type { Post } from "../schemas";
import { apiCache, posts, postsState, preferences, readPostsVm, type PostsVm } from "../state";

type PostsModel = { model: ReadableCell<PostsVm> };

const StatusLine = component("StatusLine", (_proxy, { model }: PostsModel) => {
  return (
    <div class="status-line" id="posts-status">
      <Badge
        use={bind.dataset("tone", model, (state) =>
          state.error ? "danger" : state.loading ? "warning" : "success",
        )}
      >
        {text(model, (state) => (state.loading ? "loading" : state.status))}
      </Badge>
      <span>
        {text(model, (state) => `${state.pageStart}-${state.pageEnd} of ${state.filtered}`)}
      </span>
      <span>{text(model, (state) => state.total)} parsed</span>
      <span>page {text(model, (state) => state.page)}</span>
      <span>
        updated{" "}
        {text(model, (state) =>
          state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "never",
        )}
      </span>
      {when(
        model,
        (state) => state.stale,
        () => (
          <Badge tone="warning">stale</Badge>
        ),
      )}
      {view(
        model,
        (state) => state.error,
        (error) => (error ? <span class="tone-danger">{error}</span> : null),
      )}
    </div>
  );
});

const PostsToolbar = component("PostsToolbar", (proxy) => {
  const refreshing = proxy.map([postsState], (state) => state.loading, "refreshing", true);

  return (
    <div class="button-group">
      <button
        class="button-primary"
        use={bind.props(refreshing, (loading) => ({
          disabled: loading,
          aria: { busy: loading },
          title: loading ? "Refreshing validated posts" : "Refresh posts",
        }))}
        onClick={() => void posts.refresh()}
      >
        Refresh
      </button>
      <button
        onClick={() => {
          apiCache.remove("posts");
          void posts.refresh();
        }}
      >
        Bust cache
      </button>
    </div>
  );
});

const PostCard = component("PostCard", (_proxy, props: { post: Post }) => {
  const post = props.post;
  const reactions = post.id * 7 + post.userId;
  const replies = (post.id % 9) + 1;

  return (
    <article class="panel" data-id={post.id}>
      <header class="post-author">
        <span class="avatar" aria-hidden="true">
          U{post.userId}
        </span>
        <div>
          <div class="post-byline">
            <strong>User {post.userId}</strong>
            <span>@jsonplaceholder</span>
            <Badge>#{post.id}</Badge>
          </div>
          <p>{post.id + 1}h ago via cached API</p>
        </div>
      </header>

      <div class="post-copy">
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </div>

      <div class="post-actions">
        <button class="button-quiet">Like {reactions}</button>
        <button class="button-quiet">Reply {replies}</button>
        <button class="button-quiet">Share</button>
      </div>
    </article>
  );
});

const PostsList = component("PostsList", (_proxy, { model }: PostsModel) => {
  return (
    <div class="post-list">
      <For
        store={model}
        each={(state) => state.visible}
        by={(post) => post.id}
        fallback={(state) =>
          state.search ? (
            <p class="notice">No posts match this filter.</p>
          ) : (
            <p class="notice">No posts are visible yet.</p>
          )
        }
      >
        {(post) => <PostCard post={post} />}
      </For>
    </div>
  );
});

function pageNumbers(page: number, count: number): number[] {
  const length = Math.min(5, count);
  const start = Math.max(1, Math.min(page - 2, count - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}

const PostsPagination = component("PostsPagination", (_proxy, { model }: PostsModel) => {
  return view(
    model,
    (state) => state,
    (state) => {
      if (state.pageCount <= 1) return null;

      const setPage = (page: number) =>
        preferences.update((prefs) => ({
          ...prefs,
          postPage: Math.min(Math.max(1, page), state.pageCount),
        }));

      return (
        <nav class="pagination" aria-label="Post pages">
          <div class="button-group">
            <button disabled={state.page === 1} onClick={() => setPage(state.page - 1)}>
              Prev
            </button>
            {pageNumbers(state.page, state.pageCount).map((page) => (
              <button
                aria-current={page === state.page ? "page" : undefined}
                onClick={() => setPage(page)}
              >
                {page}
              </button>
            ))}
            <button
              disabled={state.page === state.pageCount}
              onClick={() => setPage(state.page + 1)}
            >
              Next
            </button>
          </div>
          <small>
            {state.pageSize} posts per page, {state.pageCount} pages
          </small>
        </nav>
      );
    },
  );
});

export const PostsPage = component("PostsPage", (proxy) => {
  const model = proxy.map([postsState, preferences], readPostsVm, "posts view", true);

  return (
    <section class="page">
      <PageHeader title="Parsed, cached, explicit." actions={<PostsToolbar />}>
        Fetch uses the browser API, a schema validates each response, localStorage keeps stale
        snapshots, and ResourceView decides which state branch should render.
      </PageHeader>

      <fieldset class="panel control-group">
        <legend>Feed controls</legend>
        <label class="field">
          Search
          <input
            type="search"
            placeholder="Try album, photo, dolorem..."
            aria-describedby="posts-status"
            use={bind.value(
              preferences,
              (state) => state.search,
              (search) => ({ search, postPage: 1 }),
            )}
          />
        </label>
        <StatusLine model={model} />
      </fieldset>

      <SectionTitle title="Social feed">
        Keyed posts keep stable DOM while filtering, refreshing, and paging.
      </SectionTitle>

      <ResourceView
        resource={postsState}
        equality={(previous, next) => previous.data !== null && next.data !== null}
        pending={() => (
          <p class="notice" role="status">
            Loading posts...
          </p>
        )}
        error={(error) => (
          <p class="notice" data-tone="danger" role="alert">
            {safeErrorMessage(error)}
          </p>
        )}
        empty={() => <p class="notice">No posts loaded.</p>}
      >
        {() => (
          <div class="page">
            <PostsList model={model} />
            <PostsPagination model={model} />
          </div>
        )}
      </ResourceView>
    </section>
  );
});
