import { apiFetch } from "./client";

export function fetchImageOptions(source = "all") {
  return apiFetch(`/api/assets/images?source=${encodeURIComponent(source)}`);
}

export async function fetchAllAssets(source = "all") {
  const response = await apiFetch(
    `/api/assets/images?source=${encodeURIComponent(source)}`
  );

  const images = Array.isArray(response?.images) ? response.images : [];

  return {
    ...response,
    assets: images,
  };
}

export function getAssetViewUrl(asset) {
  if (asset?.thumbnailUrl) return asset.thumbnailUrl;
  if (asset?.url) return asset.url;
  if (asset?.previewUrl) return asset.previewUrl;
  if (asset?.src) return asset.src;
  return "";
}

export function getAssetDownloadUrl(asset) {
  if (asset?.downloadUrl) return asset.downloadUrl;
  return getAssetViewUrl(asset);
}

export function deleteAsset(asset) {
  if (!asset?.source || !asset?.fileName) {
    throw new Error("Asset source and fileName are required for deletion.");
  }

  return apiFetch(
    `/api/assets/image/${encodeURIComponent(asset.source)}/${encodeURIComponent(asset.fileName)}`,
    {
      method: "DELETE",
    }
  );
}