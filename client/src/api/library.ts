import { apiFetch } from "./http";

export async function syncLiked(args?: {
  maxTracks?: number;
  maxFeatureFetch?: number;
  refreshFeaturesOlderThanDays?: number;
}) {
  return apiFetch("/library/sync-liked", {
    method: "POST",
    body: JSON.stringify({
      max_tracks: args?.maxTracks,
      max_feature_fetch: args?.maxFeatureFetch,
      refresh_features_older_than_days: args?.refreshFeaturesOlderThanDays
    })
  });
}

export async function libraryCount() {
  return apiFetch<{ liked_count: number }>("/library/count");
}
