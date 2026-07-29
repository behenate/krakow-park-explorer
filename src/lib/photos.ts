import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

import { useAppStore } from '@/store';

/**
 * Copy a freshly picked photo out of the OS-managed ImagePicker cache into
 * permanent app storage. Cache URIs go dead when the system reclaims space
 * (the "memory photos sometimes blank" bug); the document directory is safe
 * from cleanup and is included in device backups.
 *
 * Returns the permanent URI, or the original URI if the copy fails (the
 * photo still shows for the current session).
 */
const PHOTOS_DIR = 'photos';

/**
 * Rebuild a stored photo URI against the *current* document directory.
 *
 * The store persists absolute file URIs, but on iOS the app sandbox
 * container path (the UUID in /var/mobile/Containers/Data/Application/…)
 * changes on every app update. A URI saved before an update then points
 * at the old container and the photo silently disappears, even though the
 * file still exists under Documents/photos in the new container.
 *
 * Any URI that points into a photos/ directory is re-anchored to the
 * current Paths.document; other URIs (legacy picker-cache paths) are
 * returned unchanged.
 */
export function resolvePhotoUri(stored: string): string {
  const marker = `/${PHOTOS_DIR}/`;
  const idx = stored.lastIndexOf(marker);
  if (idx === -1) return stored;
  const name = stored.slice(idx + marker.length);
  if (!name || name.includes('/')) return stored;
  try {
    return new File(Paths.document, PHOTOS_DIR, name).uri;
  } catch {
    return stored;
  }
}

/**
 * Whether a stored photo's file still exists. Photos added before the
 * persist fix live in the OS-managed cache and may have been deleted —
 * their URIs stay in the store but render as blank Images.
 */
export function photoExists(uri: string): boolean {
  try {
    return new File(resolvePhotoUri(uri)).exists;
  } catch {
    return false;
  }
}

/**
 * Save every stored visit photo whose file still exists to the device
 * gallery (Photos / Google Photos).
 *
 * @returns the number of photos saved, or null when the user denied the
 *   media-library permission. Photos that fail individually are skipped
 *   and not counted.
 */
export async function exportPhotosToGallery(): Promise<number | null> {
  // writeOnly: we only add to the gallery, so ask for the narrower permission.
  const perm = await requestPermissionsAsync(true).catch(() => null);
  if (!perm?.granted) return null;

  const uris = Object.values(useAppStore.getState().visits)
    .flatMap((v) => v.photos.map((p) => p.uri))
    .filter(photoExists)
    .map(resolvePhotoUri);

  let saved = 0;
  for (const uri of uris) {
    try {
      await Asset.create(uri);
      saved += 1;
    } catch {
      // Skip photos the OS refuses; keep exporting the rest.
    }
  }
  return saved;
}

export function persistPhoto(uri: string): string {
  try {
    const dir = new Directory(Paths.document, PHOTOS_DIR);
    dir.create({ intermediates: true, idempotent: true });
    const source = new File(uri);
    const name = source.name || 'photo.jpg';
    const dest = new File(dir, `${Date.now()}-${name}`);
    source.copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}
