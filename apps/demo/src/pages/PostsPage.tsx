import { bind, For, ResourceView, safeErrorMessage, view } from "@nodiffjs/core";
import { Badge, PageHeader, SectionTitle } from "../components";
import type { Post } from "../schemas";
import {
  apiCache,
  posts,
  postsVm,
  preferences,
  refreshCacheInspector,
  type PostsVm,
} from "../state";

function StatusLine(props: { state: PostsVm }) {
  const state = props.state;
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString() : "never";

  return (
    <div class="status-line">
      <Badge tone={state.error ? "danger" : state.loading ? "warning" : "success"}>
        {state.loading ? "loading" : state.status}
      </Badge>
      <span>
        {state.pageStart}-{state.pageEnd} of {state.filtered}
      </span>
      <span>{state.total} parsed</span>
      <span>page {state.page}</span>
      <span>updated {updated}</span>
      {state.stale ? <Badge tone="warning">stale</Badge> : null}
      {state.error ? <span class="tone-danger">{state.error}</span> : null}
    </div>
  );
}

function PostsToolbar() {
  return (
    <div class="button-group">
      <button
        class="button-primary"
        use={bind.props(postsVm, (state) => ({
          disabled: state.loading,
          aria: { busy: state.loading },
          title: state.loading ? "Refreshing validated posts" : "Refresh posts",
        }))}
        onClick={() => void posts.refresh()}
      >
        Refresh
      </button>
      <button
        onClick={() => {
          apiCache.remove("posts");
          refreshCacheInspector();
          void posts.refresh();
        }}
      >
        Bust cache
      </button>
    </div>
  );
}

function PostCard(props: { post: Post }) {
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
}

function PostsList() {
  return (
    <div class="post-list">
      <For
        store={postsVm}
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
}

function pageNumbers(page: number, count: number): number[] {
  const length = Math.min(5, count);
  const start = Math.max(1, Math.min(page - 2, count - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}

function PostsPagination() {
  return view(
    postsVm,
    (state) => state,
    (state) => {
      if (state.pageCount <= 1) return null;

      const setPage = (page: number) =>
        preferences.getState().setPostPage(Math.min(Math.max(1, page), state.pageCount));

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
}

export function PostsPage() {
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
            use={[
              bind.value(
                preferences,
                (state) => state.search,
                (search) => ({ search, postPage: 1 }),
              ),
              bind.aria("describedby", preferences, () => "posts-status"),
            ]}
          />
        </label>
        {view(
          postsVm,
          (state) => state,
          (state) => (
            <div id="posts-status">
              <StatusLine state={state} />
            </div>
          ),
        )}
      </fieldset>

      <SectionTitle title="Social feed">
        Keyed posts keep stable DOM while filtering, refreshing, and paging.
      </SectionTitle>

      <ResourceView
        resource={posts}
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
            <PostsList />
            <PostsPagination />
          </div>
        )}
      </ResourceView>
    </section>
  );
}
