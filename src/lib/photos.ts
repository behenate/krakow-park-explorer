import { Directory, File, Paths } from 'expo-file-system';

/**
 * Copy a freshly picked photo out of the OS-managed ImagePicker cache into
 * permanent app storage. Cache URIs go dead when the system reclaims space
 * (the "memory photos sometimes blank" bug); the document directory is safe
 * from cleanup and is included in device backups.
 *
 * Returns the permanent URI, or the original URI if the copy fails (the
 * photo still shows for the current session).
 */
/**
 * Whether a stored photo's file still exists. Photos added before the
 * persist fix live in the OS-managed cache and may have been deleted —
 * their URIs stay in the store but render as blank Images.
 */
export function photoExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function persistPhoto(uri: string): string {
  try {
    const dir = new Directory(Paths.document, 'photos');
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
