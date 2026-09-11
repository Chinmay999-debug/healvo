import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

/** Shared signed-URL resolution for private-Storage images (avatars,
 * clinic logos) that render simultaneously in several places (e.g. the
 * doctor's own photo in both TopBar and Sidebar) — a small module-level
 * cache means those don't each fire their own network request for the same
 * object. Mirrors services/documents.ts's getSignedDocumentUrl, generalized
 * across buckets.
 *
 * Cache keys are "{bucket}:{path}", and since every upload/replace writes a
 * brand-new path (see services/clinic.ts) rather than overwriting one in
 * place, a stale cache entry for an old path simply stops being requested —
 * no explicit invalidation or cache-busting query param needed. */

const SIGNED_URL_TTL_SECONDS = 3600;
// Re-fetch a little before the URL actually expires, so a component that
// happens to render right at the boundary never briefly gets a dead URL.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CacheEntry {
  url: string;
  expiresAt: number;
  promise?: Promise<string | null>;
}

const cache = new Map<string, CacheEntry>();

async function fetchSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error(`Failed to sign ${bucket}/${path}:`, error);
    return null;
  }
  return data.signedUrl;
}

/** Resolves a private Storage path to a displayable signed URL, or null
 * while resolving / when there's no path at all (caller falls back to
 * initials in that case — see components/ui/Avatar.tsx). */
export function useSignedMediaUrl(bucket: string, path: string | null | undefined): string | null {
  const key = path ? `${bucket}:${path}` : null;
  const cached = key ? cache.get(key) : undefined;
  const [url, setUrl] = useState<string | null>(
    cached && cached.expiresAt > Date.now() ? cached.url : null,
  );

  useEffect(() => {
    if (!key || !path) {
      setUrl(null);
      return;
    }
    const existing = cache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      setUrl(existing.url);
      return;
    }

    let cancelled = false;
    const promise = existing?.promise ?? fetchSignedUrl(bucket, path);
    cache.set(key, {
      url: existing?.url ?? "",
      expiresAt: existing?.expiresAt ?? 0,
      promise,
    });

    promise.then((signedUrl) => {
      if (signedUrl) {
        cache.set(key, {
          url: signedUrl,
          expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000 - REFRESH_MARGIN_MS,
        });
      } else {
        cache.delete(key);
      }
      if (!cancelled) setUrl(signedUrl);
    });

    return () => {
      cancelled = true;
    };
  }, [bucket, path, key]);

  return url;
}
