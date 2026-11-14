import {
  Assignment,
  CalendarEvent,
  CreateDocParams,
  EmailMessage,
  SchoolFile,
  ApiEnablementInfo,
} from '../types';
import { extractPlainBody } from '../utils/emailText';
import { decodeTrustNotes, encodeTrustNotes } from '../utils/trust';
import { auth, getActiveGoogleUid } from './firebase';
import { formatDate, t } from './i18n';

import rawFirebaseConfig from '../../firebase-applet-config.json';

export const DEFAULT_PROJECT_NUMBER = (() => {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_PROJECT_ID) || (typeof process !== 'undefined' ? (process as any).env?.VITE_GOOGLE_PROJECT_ID : undefined);
  return env || rawFirebaseConfig.projectId || 'studentcommandcenter-39cdc';
})();

export class GoogleApiDisabledError extends Error {
  isServiceDisabled = true;
  serviceName: string;
  serviceId: string;
  activationUrl: string;
  projectId: string;

  constructor(
    serviceName: string,
    serviceId: string,
    activationUrl: string,
    projectId: string,
    originalMessage?: string
  ) {
    super(
      t('gw_service_unavailable', { service: serviceName })
    );
    this.name = 'GoogleApiDisabledError';
    this.serviceName = serviceName;
    this.serviceId = serviceId;
    this.activationUrl = activationUrl;
    this.projectId = projectId;
  }
}

async function assertGoogleResponseOk(
  res: Response,
  defaultServiceName: string,
  defaultServiceId: string
): Promise<void> {
  if (res.status === 401) {
    throw new Error(t('gw_service_expired', { service: defaultServiceName }));
  }
  if (!res.ok) {
    const errBody = await res.text();
    throw parseGoogleApiResponseError(res.status, errBody, defaultServiceName, defaultServiceId);
  }
}

export function parseGoogleApiResponseError(
  status: number,
  bodyText: string,
  defaultServiceName: string,
  defaultServiceId: string
): Error {
  try {
    const json = JSON.parse(bodyText);
    const err = json?.error;
    const msg = err?.message || bodyText;
    const details = err?.details || [];

    // Detect 403 API disabled / not configured in project
    const isServiceDisabled =
      status === 403 &&
      (msg.includes('before or it is disabled') ||
        msg.includes('SERVICE_DISABLED') ||
        msg.includes('accessNotConfigured') ||
        msg.includes('has not been used in project') ||
        details.some((d: any) => d.reason === 'SERVICE_DISABLED'));

    if (isServiceDisabled) {
      let activationUrl = '';
      let projectId = DEFAULT_PROJECT_NUMBER;

      for (const d of details) {
        if (d?.metadata?.activationUrl) {
          activationUrl = d.metadata.activationUrl;
        }
        if (d?.metadata?.consumer) {
          projectId = d.metadata.consumer.replace('projects/', '');
        }
      }

      if (!activationUrl) {
        const linkDetail = details.find((d: any) => d?.links?.[0]?.url);
        if (linkDetail?.links?.[0]?.url) {
          activationUrl = linkDetail.links[0].url;
        }
      }

      if (!activationUrl) {
        activationUrl = `https://console.developers.google.com/apis/api/${defaultServiceId}/overview?project=${projectId}`;
      }

      return new GoogleApiDisabledError(
        defaultServiceName,
        defaultServiceId,
        activationUrl,
        projectId,
        msg
      );
    }

    // Detect insufficient OAuth scopes
    const isScopeError =
      status === 403 &&
      (msg.includes('insufficient') ||
        msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        msg.includes('insufficientPermissions') ||
        msg.includes('insufficient authentication scopes'));

    if (isScopeError) {
      return new Error(t('gw_needs_permission', { service: defaultServiceName }));
    }

    return new Error(t('gw_request_failed_msg', { service: defaultServiceName, msg }));
  } catch {
    return new Error(t('gw_request_failed_status', { service: defaultServiceName, status }));
  }
}

// ==========================================
// GOOGLE CALENDAR API
// ==========================================

export async function fetchTodayCalendarEvents(token: string): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      startOfDay
    )}&timeMax=${encodeURIComponent(
      endOfDay
    )}&singleEvents=true&orderBy=startTime&maxResults=50`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      throw new Error(t('gw_cal_expired'));
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw parseGoogleApiResponseError(res.status, errBody, 'Google Calendar', 'calendar-json.googleapis.com');
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || t('gw_cal_untitled_event'),
      start: item.start || {},
      end: item.end || {},
      location: item.location || '',
      description: item.description || '',
      htmlLink: item.htmlLink,
      hangoutLink: item.hangoutLink,
      isStudyBlock:
        (item.summary || '').toLowerCase().includes('study') ||
        (item.summary || '').toLowerCase().includes('focus'),
      colorId: item.colorId,
    }));
  } catch (error) {
    console.error('Error fetching Calendar events:', error);
    throw error;
  }
}

export async function fetchUpcomingCalendarEvents(
  token: string,
  daysAhead = 7
): Promise<CalendarEvent[]> {
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const timeMax = future.toISOString();

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(
      timeMax
    )}&singleEvents=true&orderBy=startTime&maxResults=100`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(t('gw_cal_api_err', { status: res.statusText || String(res.status) }));
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || t('gw_cal_untitled'),
      start: item.start || {},
      end: item.end || {},
      location: item.location || '',
      description: item.description || '',
      htmlLink: item.htmlLink,
      hangoutLink: item.hangoutLink,
      isStudyBlock:
        (item.summary || '').toLowerCase().includes('study') ||
        (item.summary || '').toLowerCase().includes('focus'),
    }));
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }
}

export async function insertCalendarEvent(
  token: string,
  eventData: {
    summary: string;
    description?: string;
    start: { dateTime: string };
    end: { dateTime: string };
    location?: string;
  }
): Promise<CalendarEvent> {
  const eventPayload = {
    summary: eventData.summary,
    description: eventData.description || 'Focus study block from Student Command Center',
    start: {
      dateTime: eventData.start.dateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: eventData.end.dateTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    location: eventData.location,
    colorId: '9', // Focus Blue
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 10 },
        { method: 'popup', minutes: 2 },
      ],
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventPayload),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw parseGoogleApiResponseError(res.status, errBody, 'Google Calendar API', 'calendar-json.googleapis.com');
  }

  const created = await res.json();
  return {
    id: created.id,
    summary: created.summary,
    start: created.start,
    end: created.end,
    location: created.location,
    description: created.description,
    htmlLink: created.htmlLink,
    isStudyBlock: true,
  };
}

export const createStudyBlockCalendarEvent = insertCalendarEvent;

// Find an open 45-minute slot before the due date
export function findSuggestedStudySlot(
  existingEvents: CalendarEvent[],
  dueDateStr: string,
  durationMinutes = 45
): { start: Date; end: Date } {
  const now = new Date();
  const due = new Date(dueDateStr + 'T23:59:59');

  let searchDate = new Date(now);
  searchDate.setMinutes(0, 0, 0);
  searchDate.setHours(searchDate.getHours() + 1);

  while (searchDate <= due) {
    const dayStart = new Date(searchDate);
    dayStart.setHours(15, 0, 0, 0);

    if (dayStart < now) {
      dayStart.setTime(now.getTime() + 30 * 60 * 1000);
      const remainder = 15 - (dayStart.getMinutes() % 15);
      dayStart.setMinutes(dayStart.getMinutes() + remainder, 0, 0);
    }

    const dayEnd = new Date(searchDate);
    dayEnd.setHours(21, 0, 0, 0);

    let candidate = new Date(dayStart);

    while (candidate.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
      const candidateEnd = new Date(candidate.getTime() + durationMinutes * 60 * 1000);

      const hasConflict = existingEvents.some((ev) => {
        const evStart = ev.start.dateTime ? new Date(ev.start.dateTime) : null;
        const evEnd = ev.end.dateTime ? new Date(ev.end.dateTime) : null;
        if (!evStart || !evEnd) return false;
        return candidate < evEnd && candidateEnd > evStart;
      });

      if (!hasConflict) {
        return { start: candidate, end: candidateEnd };
      }

      candidate = new Date(candidate.getTime() + 30 * 60 * 1000);
    }

    searchDate.setDate(searchDate.getDate() + 1);
    searchDate.setHours(15, 0, 0, 0);
  }

  const fallbackStart = new Date();
  fallbackStart.setDate(fallbackStart.getDate() + 1);
  fallbackStart.setHours(16, 0, 0, 0);
  const fallbackEnd = new Date(fallbackStart.getTime() + durationMinutes * 60 * 1000);
  return { start: fallbackStart, end: fallbackEnd };
}

// ==========================================
// GMAIL API
// ==========================================

export interface FetchEmailOptions {
  maxResults?: number;
  mode?: 'inbox' | 'academic';
  customQuery?: string;
}

export async function fetchAcademicEmails(
  token: string,
  options?: FetchEmailOptions
): Promise<EmailMessage[]> {
  try {
    const maxResults = options?.maxResults || 25;
    let query = options?.customQuery;
    if (!query) {
      if (options?.mode === 'academic') {
        // Academic mode: keep broad inbox scope, trust Gmail native categories
        // instead of keyword OR-lists. Spam/Trash excluded at API level.
        query = 'in:inbox -in:chats -in:spam -in:trash';
      } else {
        // Default: latest inbox, Gmail-native spam/trash already excluded.
        query = 'in:inbox -in:chats -in:spam -in:trash';
      }
    }

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
      query
    )}&maxResults=${maxResults}`;

    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (listRes.status === 401) {
      throw new Error(t('gw_gmail_expired'));
    }

    if (!listRes.ok) {
      const errBody = await listRes.text();
      if (listRes.status === 403 && (errBody.includes('insufficient') || errBody.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) {
        throw new Error(t('gw_gmail_needs_permission'));
      }
      throw parseGoogleApiResponseError(listRes.status, errBody, 'Gmail', 'gmail.googleapis.com');
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];

    const detailedEmails: EmailMessage[] = await Promise.all(
      messages.map(async (msg: { id: string; threadId: string }) => {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!detailRes.ok) return null;
          const data = await detailRes.json();

          const headers = data.payload?.headers || [];
          const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
          const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
          const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

          let bodySnippet = data.snippet || '';
          // Full body (the deadline is often below the 200-char snippet) + exact send time,
          // the anchor the AI needs to resolve "thứ 6 tuần này".
          const body = extractPlainBody(data.payload);
          const sentMs = Number(data.internalDate) || (dateHeader ? Date.parse(dateHeader.value) : NaN);
          return {
            id: data.id,
            threadId: data.threadId,
            sender: fromHeader ? fromHeader.value.replace(/<.*>/, '').replace(/"/g, '').trim() : t('gw_gmail_instructor'),
            senderEmail: fromHeader ? (fromHeader.value.match(/<([^>]+)>/)?.[1] || fromHeader.value) : '',
            subject: subjectHeader ? subjectHeader.value : t('gw_gmail_no_subject'),
            date: dateHeader ? formatDate(dateHeader.value) : t('gw_gmail_recent'),
            dateISO: Number.isFinite(sentMs) ? new Date(sentMs).toISOString() : undefined,
            snippet: bodySnippet,
            body: body || undefined,
            unread: Array.isArray(data.labelIds) && data.labelIds.includes('UNREAD'),
            labelIds: Array.isArray(data.labelIds) ? data.labelIds : [],
          };
        } catch (e) {
          return null;
        }
      })
    );

    return detailedEmails.filter((m): m is EmailMessage => m !== null);
  } catch (error) {
    console.error('Error in fetchAcademicEmails:', error);
    throw error;
  }
}

export async function createGmailDraft(
  token: string,
  to: string,
  subject: string,
  body: string
): Promise<{ draftId: string; webUrl: string }> {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ];
  const emailText = emailLines.join('\r\n');

  const base64Encoded = btoa(unescape(encodeURIComponent(emailText)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        raw: base64Encoded,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw parseGoogleApiResponseError(res.status, err, 'Gmail API', 'gmail.googleapis.com');
  }

  const result = await res.json();
  let email = '';
  try {
    if (typeof localStorage !== 'undefined') {
      email = localStorage.getItem('scc_google_email_v1')?.trim() || '';
    }
  } catch {}
  const encodedId = encodeURIComponent(result.id);
  const webUrl = email
    ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#drafts/${encodedId}`
    : `https://mail.google.com/mail/#drafts/${encodedId}`;
  return {
    draftId: result.id,
    webUrl,
  };
}

// ==========================================
// GOOGLE SHEETS API (Master Assignment Tracker)
// ==========================================

export const MASTER_SHEET_TITLE = 'Student Master Assignment Tracker';
const MASTER_SHEET_LEGACY_KEY = 'scc_master_sheet_id';
const MASTER_SHEET_OWNER_KEY = 'scc_master_sheet_owner';

function resolveSheetCacheUid(explicitUid?: string | null): string | null {
  if (explicitUid && explicitUid.trim()) return explicitUid.trim();
  try {
    if (auth?.currentUser?.uid) return auth.currentUser.uid;
  } catch {}
  return getActiveGoogleUid();
}

function getScopedMasterSheetId(uid: string | null): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    if (uid) {
      const scopedKey = `${MASTER_SHEET_LEGACY_KEY}_${uid}`;
      const scoped = localStorage.getItem(scopedKey);
      if (scoped) return scoped;
      // One-time migration from legacy unscoped key if unowned or owned by the same user
      const legacy = localStorage.getItem(MASTER_SHEET_LEGACY_KEY);
      const owner = localStorage.getItem(MASTER_SHEET_OWNER_KEY);
      if (legacy && (!owner || owner === uid)) {
        localStorage.setItem(scopedKey, legacy);
        localStorage.setItem(MASTER_SHEET_OWNER_KEY, uid);
        localStorage.removeItem(MASTER_SHEET_LEGACY_KEY);
        return legacy;
      }
      return null;
    }
    const owner = localStorage.getItem(MASTER_SHEET_OWNER_KEY);
    if (owner && owner !== 'anonymous') return null;
    return localStorage.getItem(MASTER_SHEET_LEGACY_KEY);
  } catch {
    return null;
  }
}

function setScopedMasterSheetId(spreadsheetId: string, uid: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (uid) {
      localStorage.setItem(`${MASTER_SHEET_LEGACY_KEY}_${uid}`, spreadsheetId);
      localStorage.setItem(MASTER_SHEET_OWNER_KEY, uid);
      localStorage.removeItem(MASTER_SHEET_LEGACY_KEY);
    } else {
      localStorage.setItem(MASTER_SHEET_LEGACY_KEY, spreadsheetId);
      localStorage.setItem(MASTER_SHEET_OWNER_KEY, 'anonymous');
    }
  } catch {}
}

function clearScopedMasterSheetId(uid: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (uid) {
      localStorage.removeItem(`${MASTER_SHEET_LEGACY_KEY}_${uid}`);
    } else {
      localStorage.removeItem(MASTER_SHEET_LEGACY_KEY);
    }
  } catch {}
}

export async function findOrCreateMasterSpreadsheet(
  token: string,
  uid?: string | null
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; isNew: boolean }> {
  const resolvedUid = resolveSheetCacheUid(uid);
  try {
    // 1. Check per-uid local cache first for instant sync without hitting Drive search
    const cachedId = getScopedMasterSheetId(resolvedUid);
    if (cachedId) {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cachedId}?fields=spreadsheetId,spreadsheetUrl`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const file = await checkRes.json();
        return {
          spreadsheetId: file.spreadsheetId,
          spreadsheetUrl: file.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${file.spreadsheetId}/edit`,
          isNew: false,
        };
      }
      if (checkRes.status === 401) {
        throw new Error(t('gw_sheets_expired'));
      }
      if (checkRes.status === 404 || checkRes.status === 403) {
        clearScopedMasterSheetId(resolvedUid);
      }
    }

    // 2. Try Drive search if available
    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${MASTER_SHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
      )}&fields=files(id,name,webViewLink)`;

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.files && data.files.length > 0) {
          const file = data.files[0];
          setScopedMasterSheetId(file.id, resolvedUid);
          return {
            spreadsheetId: file.id,
            spreadsheetUrl: file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`,
            isNew: false,
          };
        }
      }
    } catch {
      // Drive search may not be authorized; continue to direct Sheets creation
    }

    // 3. Create fresh spreadsheet directly via Google Sheets API
    const createPayload = {
      properties: {
        title: MASTER_SHEET_TITLE,
      },
      sheets: [
        {
          properties: {
            title: 'Assignments',
            gridProperties: {
              frozenRowCount: 1,
              columnCount: 8,
              rowCount: 100,
            },
          },
        },
      ],
    };

    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createPayload),
    });

    if (createRes.status === 401) {
      throw new Error(t('gw_sheets_expired'));
    }

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw parseGoogleApiResponseError(createRes.status, errBody, 'Google Sheets', 'sheets.googleapis.com');
    }

    const createdSheet = await createRes.json();
    const spreadsheetId = createdSheet.spreadsheetId;
    setScopedMasterSheetId(spreadsheetId, resolvedUid);

    const headerValues = [
      ['Subject', 'Assignment Name', 'Due Date', 'Priority', 'Status', 'Source', 'Doc Link', 'Notes'],
    ];

    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A1:H1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: headerValues }),
      }
    );
    await assertGoogleResponseOk(headerRes, 'Google Sheets API', 'sheets.googleapis.com');

    const formatPayload = {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: 0,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.15, green: 0.25, blue: 0.45 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                horizontalAlignment: 'CENTER',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
          },
        },
      ],
    };

    const formatRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formatPayload),
    });
    await assertGoogleResponseOk(formatRes, 'Google Sheets API', 'sheets.googleapis.com');

    return {
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      isNew: true,
    };
  } catch (error) {
    console.error('Error in findOrCreateMasterSpreadsheet:', error);
    throw error;
  }
}

export const getOrCreateMasterSheet = findOrCreateMasterSpreadsheet;

export async function readAssignmentsFromSheet(
  token: string,
  spreadsheetId: string
): Promise<Assignment[]> {
  try {
    let res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A2:H`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      throw new Error(t('gw_sheets_expired'));
    }

    // Fallback to first sheet range if Assignments tab is named differently
    if (!res.ok && res.status === 400) {
      const fallbackRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:H`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fallbackRes.ok) {
        res = fallbackRes;
      }
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw parseGoogleApiResponseError(res.status, errBody, 'Google Sheets API', 'sheets.googleapis.com');
    }

    const data = await res.json();
    const rows: string[][] = data.values || [];

    return rows.reduce<Assignment[]>((acc, row: string[], index: number) => {
      if (!Array.isArray(row) || row.every((cell) => !String(cell ?? '').trim())) {
        return acc;
      }
      acc.push({
        id: `sheet-${index + 2}`,
        sheetRowIndex: index + 2,
        subject: row[0] || 'General',
        assignmentName: row[1] || 'Untitled Assignment',
        dueDate: row[2] || '',
        priority: (row[3] as any) || 'Med',
        status: (row[4] as any) || 'Not Started',
        source: (row[5] as any) || 'Google Sheet',
        docUrl: row[6] || '',
        ...decodeTrustNotes(row[7] || ''),
      });
      return acc;
    }, []);
  } catch (error) {
    console.error('Error reading assignments from Sheet:', error);
    throw error;
  }
}

export const fetchSheetAssignments = readAssignmentsFromSheet;

export async function appendAssignmentToSheet(
  token: string,
  spreadsheetId: string,
  assignment: Omit<Assignment, 'id'>
): Promise<Assignment> {
  const row = [
    assignment.subject,
    assignment.assignmentName,
    assignment.dueDate,
    assignment.priority,
    assignment.status,
    assignment.source || 'Manual',
    assignment.docUrl || assignment.sourceUrl || '',
    encodeTrustNotes(assignment),
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A:H:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (res.status === 401) {
    throw new Error(t('gw_sheets_unauthorized'));
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw parseGoogleApiResponseError(res.status, errBody, 'Google Sheets API', 'sheets.googleapis.com');
  }

  const data = await res.json();
  // Extract appended range row index if available
  const updatedRange = data.updates?.updatedRange || '';
  const match = updatedRange.match(/A(\d+)/);
  const rowIndex = match ? parseInt(match[1], 10) : undefined;

  return {
    ...assignment,
    id: `sheet-${rowIndex || Date.now()}`,
    sheetRowIndex: rowIndex,
  };
}

export async function updateAssignmentStatusInSheet(
  token: string,
  spreadsheetId: string,
  rowIndex: number,
  status: string
): Promise<void> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!E${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [[status]] }),
    }
  );

  if (res.status === 401) {
    throw new Error(t('gw_sheets_unauthorized'));
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw parseGoogleApiResponseError(res.status, errBody, 'Google Sheets API', 'sheets.googleapis.com');
  }
}

export async function updateAssignmentInSheet(
  token: string,
  spreadsheetId: string,
  assignment: Assignment
): Promise<void> {
  if (!assignment.sheetRowIndex || assignment.sheetRowIndex < 2) return;
  const rowIndex = assignment.sheetRowIndex;
  const row = [
    assignment.subject,
    assignment.assignmentName,
    assignment.dueDate,
    assignment.priority,
    assignment.status,
    assignment.source || 'Manual',
    assignment.docUrl || assignment.sourceUrl || '',
    encodeTrustNotes(assignment),
  ];

  let res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A${rowIndex}:H${rowIndex}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [row] }),
    }
  );

  if (!res.ok && res.status === 400) {
    const fallbackRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A${rowIndex}:H${rowIndex}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      }
    );
    if (fallbackRes.ok || fallbackRes.status === 401) {
      res = fallbackRes;
    }
  }

  await assertGoogleResponseOk(res, 'Google Sheets API', 'sheets.googleapis.com');
}

export async function deleteAssignmentInSheet(
  token: string,
  spreadsheetId: string,
  rowIndexOrAssignment: number | Assignment
): Promise<void> {
  const rowIndex =
    typeof rowIndexOrAssignment === 'number'
      ? rowIndexOrAssignment
      : rowIndexOrAssignment.sheetRowIndex;
  if (!rowIndex || rowIndex < 2) return;

  const deleteRow = (sheetId: number) =>
    fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex,
              },
            },
          },
        ],
      }),
    });

  let batchRes = await deleteRow(0);

  if (!batchRes.ok && batchRes.status === 400) {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const sheets: Array<{ properties?: { sheetId?: number; title?: string } }> = meta.sheets || [];
      const targetSheet =
        sheets.find((s) => s.properties?.title === 'Assignments') || sheets[0];
      const resolvedSheetId = targetSheet?.properties?.sheetId;
      if (typeof resolvedSheetId === 'number' && resolvedSheetId !== 0) {
        batchRes = await deleteRow(resolvedSheetId);
      }
    }
  }

  await assertGoogleResponseOk(batchRes, 'Google Sheets API', 'sheets.googleapis.com');
}

export async function syncAllAssignmentsToSheet(
  token: string,
  spreadsheetId: string,
  assignments: Assignment[]
): Promise<Assignment[]> {
  const rows = assignments.map((a) => [
    a.subject,
    a.assignmentName,
    a.dueDate,
    a.priority,
    a.status,
    a.source || 'Manual',
    a.docUrl || a.sourceUrl || '',
    encodeTrustNotes(a),
  ]);

  if (rows.length === 0) {
    let clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A2:H:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!clearRes.ok && clearRes.status === 400) {
      const fallbackClear = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:H:clear`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (fallbackClear.ok || fallbackClear.status === 401) {
        clearRes = fallbackClear;
      }
    }
    await assertGoogleResponseOk(clearRes, 'Google Sheets API', 'sheets.googleapis.com');
    return [];
  }

  // 1. Write new rows FIRST so existing sheet data is NEVER wiped if the write fails.
  const endRow = rows.length + 1;
  let putRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A2:H${endRow}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!putRes.ok && putRes.status === 400) {
    const fallbackPut = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:H${endRow}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );
    if (fallbackPut.ok || fallbackPut.status === 401) {
      putRes = fallbackPut;
    }
  }
  await assertGoogleResponseOk(putRes, 'Google Sheets API', 'sheets.googleapis.com');

  // 2. Only after PUT succeeds, clear any extra trailing rows below the newly written range.
  const trailingStart = endRow + 1;
  let clearTrailingRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Assignments!A${trailingStart}:H:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!clearTrailingRes.ok && clearTrailingRes.status === 400) {
    const fallbackTrailing = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A${trailingStart}:H:clear`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    if (fallbackTrailing.ok || fallbackTrailing.status === 401) {
      clearTrailingRes = fallbackTrailing;
    }
  }
  if (!clearTrailingRes.ok && clearTrailingRes.status !== 400) {
    await assertGoogleResponseOk(clearTrailingRes, 'Google Sheets API', 'sheets.googleapis.com');
  }

  return assignments.map((a, index) => ({
    ...a,
    id: `sheet-${index + 2}`,
    sheetRowIndex: index + 2,
  }));
}

// ==========================================
// GOOGLE DRIVE & DOCS API
// ==========================================

export async function fetchRecentSchoolFiles(
  token: string,
  limit = 20
): Promise<SchoolFile[]> {
  try {
    // Exclude folders and trashed items so that any document, spreadsheet, presentation, PDF, or text file appears
    const query = `trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
    const primaryUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&orderBy=modifiedTime desc&pageSize=${limit}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    let res = await fetch(primaryUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      throw new Error(t('gw_drive_expired'));
    }

    // Fallback for personal accounts where supportsAllDrives can throw 400, 403 or 404
    if (!res.ok && (res.status === 400 || res.status === 403 || res.status === 404)) {
      const fallbackUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        query
      )}&orderBy=modifiedTime desc&pageSize=${limit}&fields=files(id,name,mimeType,modifiedTime,webViewLink,iconLink,size)`;
      try {
        const fallbackRes = await fetch(fallbackUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (fallbackRes.ok) {
          res = fallbackRes;
        }
      } catch {}
    }

    if (!res.ok) {
      const errBody = await res.text();
      // If token only has drive.file scope or query denied on full drive, return [] gracefully
      if (res.status === 403 && (errBody.includes('insufficient') || errBody.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))) {
        console.warn('Drive scope limited to app files (drive.file). Returning accessible files.');
        return [];
      }
      throw parseGoogleApiResponseError(res.status, errBody, 'Google Drive API', 'drive.googleapis.com');
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => {
      let webViewLink = f.webViewLink;
      if (!webViewLink && f.id) {
        if (f.mimeType?.includes('spreadsheet')) {
          webViewLink = `https://docs.google.com/spreadsheets/d/${f.id}/edit`;
        } else if (f.mimeType?.includes('presentation')) {
          webViewLink = `https://docs.google.com/presentation/d/${f.id}/edit`;
        } else {
          webViewLink = `https://docs.google.com/document/d/${f.id}/edit`;
        }
      }
      return {
        id: f.id,
        name: f.name || 'Untitled Document',
        mimeType: f.mimeType || 'application/octet-stream',
        modifiedTime: f.modifiedTime || new Date().toISOString(),
        webViewLink: webViewLink || `https://drive.google.com`,
        iconLink: f.iconLink,
        size: f.size,
      };
    });
  } catch (error) {
    console.error('Error fetching recent Drive files:', error);
    throw error;
  }
}

export async function createFormattedAssignmentDoc(
  token: string,
  params: CreateDocParams
): Promise<{ documentId: string; webViewLink: string }> {
  try {
    const docTitle = `${params.subject} - ${params.title}`;
    const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: docTitle }),
    });

    if (createRes.status === 401) {
      throw new Error(t('gw_docs_expired'));
    }

    if (!createRes.ok) {
      const errBody = await createRes.text();
      throw parseGoogleApiResponseError(createRes.status, errBody, 'Google Docs', 'docs.googleapis.com');
    }

    const createdDoc = await createRes.json();
    const documentId = createdDoc.documentId;

    const todayFormatted = formatDate(new Date(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    let headerBlock = '';
    if (params.formatStyle === 'MLA') {
      headerBlock = `${params.studentName || 'Student Name'}\n${
        params.teacherName || 'Instructor Name'
      }\n${params.subject}\n${todayFormatted}\n\n`;
    } else if (params.formatStyle === 'APA') {
      headerBlock = `Running Head: ${params.title.toUpperCase().slice(0, 30)}\n\n${params.title}\n${
        params.studentName || 'Student Name'
      }\n${params.subject}\n${params.teacherName || 'Instructor Name'}\n${todayFormatted}\n\n`;
    } else {
      headerBlock = `COURSE: ${params.subject}\nASSIGNMENT: ${params.title}\nINSTRUCTOR: ${
        params.teacherName || 'Professor'
      }\nDATE: ${todayFormatted}\n\n`;
    }

    const titleBlock = `${params.title}\n\n`;

    const objectivesBlock = `I. OBJECTIVES & REQUIREMENTS\n${
      params.objectives ||
      '- Understand the core concepts and research prompt.\n- Apply critical analysis and structured arguments.\n- Ensure all references and citations adhere to academic integrity standards.'
    }\n\n`;

    const checklistBlock = `II. ACTION CHECKLIST\n${
      params.checklist && params.checklist.length > 0
        ? params.checklist.map((item) => `[ ] ${item}`).join('\n')
        : '[ ] Initial background reading and note taking\n[ ] Create detailed outline with primary thesis\n[ ] Draft introduction and body arguments\n[ ] Insert citations and bibliography\n[ ] Final proofread for formatting and tone'
    }\n\n`;

    const canvasBlock = params.canvasDescription
      ? `III. CANVAS ASSIGNMENT DETAILS & RUBRIC\n${params.canvasDescription
          .replace(/<[^>]*>?/gm, '')
          .slice(0, 1500)}\n\n`
      : '';

    const notesBlock = `IV. RESEARCH NOTES & ROUGH DRAFT\n[Begin drafting here...]\n\n`;

    const fullContent = `${headerBlock}${titleBlock}${objectivesBlock}${checklistBlock}${canvasBlock}${notesBlock}`;

    const updatePayload = {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: fullContent,
          },
        },
      ],
    };

    const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });
    await assertGoogleResponseOk(batchRes, 'Google Docs API', 'docs.googleapis.com');

    return {
      documentId,
      webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  } catch (error) {
    console.error('Error creating assignment Doc:', error);
    throw error;
  }
}

export const createAssignmentDoc = createFormattedAssignmentDoc;

/**
 * Auto-share a Google Drive file so anyone with the link can view it (reader permission)
 * This avoids 403 access denied errors for teachers when graded.
 * POST https://www.googleapis.com/drive/v3/files/{fileId}/permissions
 */
export async function shareGoogleDriveFile(token: string, fileId: string, emailAddress?: string): Promise<any> {
  // With an email: share with that one person (the teacher). Without: anyone-with-link,
  // which callers must only use after the student explicitly agreed.
  const email = (emailAddress || '').trim();
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions${email ? '?sendNotificationEmail=true' : ''}`;
  
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const body = email
    ? { role: 'reader', type: 'user', emailAddress: email }
    : { role: 'reader', type: 'anyone', allowFileDiscovery: false };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw parseGoogleApiResponseError(res.status, text, 'Google Drive Permissions API', 'drive.googleapis.com');
  }

  return res.json();
}
