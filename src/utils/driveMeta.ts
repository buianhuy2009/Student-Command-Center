import type { SchoolFile } from '../types';

/** Every Drive file request asks for the same metadata, including who owns it and when it appeared. */
export const DRIVE_FILE_FIELDS =
  'id,name,mimeType,modifiedTime,createdTime,sharedWithMeTime,driveId,owners(displayName,me),webViewLink,iconLink,size';

interface DriveApiOwnerFields {
  owners?: Array<{ displayName?: string; me?: boolean }>;
  driveId?: string;
  createdTime?: string;
  sharedWithMeTime?: string;
}

export function readDriveOwnerFields(file: DriveApiOwnerFields) {
  const owner = file.owners?.[0];
  return {
    ownerName: owner?.displayName,
    ownedByMe: owner?.me,
    sharedDrive: Boolean(file.driveId) || undefined,
    createdTime: file.createdTime,
    sharedWithMeTime: file.sharedWithMeTime,
  };
}

/**
 * When the file arrived: added to StudentOS, else shared with the student, else created.
 * Device files saved before this was recorded carry the time inside their local ID.
 */
export function getDriveDateAdded(file: SchoolFile): string | undefined {
  const localStamp = file.origin === 'local' ? /^local-(\d{12,})-/.exec(file.id)?.[1] : undefined;
  return (
    file.addedAt ||
    (localStamp ? new Date(Number(localStamp)).toISOString() : undefined) ||
    file.sharedWithMeTime ||
    file.createdTime
  );
}
