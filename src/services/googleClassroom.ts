import { CanvasAssignment, ApiEnablementInfo, EmailMessage } from '../types';
import { parseGoogleApiResponseError } from './googleWorkspace';

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  room?: string;
  alternateLink?: string;
}

export interface ClassroomCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  dueDate?: {
    year: number;
    month: number;
    day: number;
  };
  dueTime?: {
    hours?: number;
    minutes?: number;
  };
  maxPoints?: number;
}

export interface ClassroomAnnouncement {
  id: string;
  courseId: string;
  text: string;
  alternateLink?: string;
  creationTime?: string;
}

/**
 * Fetch all active Google Classroom courses for the signed-in student
 */
export async function fetchClassroomCourses(token: string): Promise<ClassroomCourse[]> {
  try {
    // 1. First try student-specific query (standard for student accounts in school domains)
    let res = await fetch('https://classroom.googleapis.com/v1/courses?studentId=me&courseStates=ACTIVE', {
      headers: { Authorization: `Bearer ${token}` },
    });

    // 2. Fallback to general active courses query
    if (!res.ok && (res.status === 400 || res.status === 403 || res.status === 404)) {
      res = await fetch('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    // 3. Fallback to base courses query
    if (!res.ok && (res.status === 400 || res.status === 403)) {
      res = await fetch('https://classroom.googleapis.com/v1/courses', {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    if (res.status === 401) {
      throw new Error('Google Classroom session expired or unauthorized (401).');
    }

    if (!res.ok) {
      const errBody = await res.text();
      if (res.status === 403 && (errBody.includes('insufficient') || errBody.includes('PERMISSION_DENIED') || errBody.includes('not a member'))) {
        console.warn('Google Classroom access not available or no active courses for this account.');
        return [];
      }
      throw parseGoogleApiResponseError(res.status, errBody, 'Google Classroom API', 'classroom.googleapis.com');
    }

    const data = await res.json();
    return data.courses || [];
  } catch (error) {
    console.error('Error fetching Google Classroom courses:', error);
    throw error;
  }
}

/**
 * Fetch coursework (assignments, projects, quizzes) for a specific course
 */
export async function fetchCourseWork(token: string, courseId: string): Promise<ClassroomCourseWork[]> {
  try {
    let res = await fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?courseWorkStates=PUBLISHED`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Fallback if courseWorkStates is restricted for non-teacher roles
    if (!res.ok && (res.status === 400 || res.status === 403)) {
      res = await fetch(
        `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw parseGoogleApiResponseError(res.status, errBody, 'Google Classroom API', 'classroom.googleapis.com');
    }

    const data = await res.json();
    return data.courseWork || [];
  } catch (error) {
    console.error(`Error fetching coursework for course ${courseId}:`, error);
    throw error;
  }
}

/**
 * Fetch all upcoming coursework across all active courses
 */
export async function fetchAllClassroomAssignments(token: string): Promise<CanvasAssignment[]> {
  try {
    const courses = await fetchClassroomCourses(token);
    if (!courses || courses.length === 0) return [];

    const assignments: CanvasAssignment[] = [];

    await Promise.all(
      courses.map(async (course) => {
        try {
          const works = await fetchCourseWork(token, course.id);
          works.forEach((w) => {
            let dueAt = '';
            if (w.dueDate) {
              const y = w.dueDate.year;
              const m = String(w.dueDate.month).padStart(2, '0');
              const d = String(w.dueDate.day).padStart(2, '0');
              dueAt = `${y}-${m}-${d}`;
            }

            assignments.push({
              id: `gclass-${w.id}`,
              name: w.title,
              courseName: course.name,
              courseId: course.id,
              dueAt,
              pointsPossible: w.maxPoints,
              htmlUrl: w.alternateLink || course.alternateLink,
              description: w.description || '',
              isSynced: false,
              submissionTypes: ['online_upload'],
            });
          });
        } catch (e) {
          console.warn(`Could not load coursework for course ${course.id}:`, e);
        }
      })
    );

    return assignments;
  } catch (error) {
    console.error('Error fetching all Classroom assignments:', error);
    throw error;
  }
}

/**
 * Recent teacher announcements across active courses, shaped like emails so they run
 * through the same AI reader → confirm card → review box. THCS teachers often give
 * homework in a "Thông báo" post instead of a Classroom assignment.
 */
export async function fetchRecentClassroomAnnouncements(token: string, days = 21): Promise<EmailMessage[]> {
  const courses = await fetchClassroomCourses(token);
  const since = Date.now() - days * 86400000;
  const out: EmailMessage[] = [];
  await Promise.all(
    (courses || []).slice(0, 20).map(async (course) => {
      try {
        const res = await fetch(
          `https://classroom.googleapis.com/v1/courses/${course.id}/announcements?pageSize=10&orderBy=updateTime%20desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) return;
        const data = await res.json();
        for (const a of (data.announcements || []) as Array<ClassroomAnnouncement & { updateTime?: string; creatorUserId?: string }>) {
          const when = a.updateTime || a.creationTime || '';
          if (!a.text || (when && Date.parse(when) < since)) continue;
          out.push({
            id: `gca-${a.id}`,
            sender: course.name,
            senderEmail: 'no-reply@classroom.google.com',
            subject: `Thông báo · ${course.name}`,
            date: when ? new Date(when).toLocaleDateString() : '',
            dateISO: when || undefined,
            snippet: a.text.slice(0, 200),
            body: a.text.slice(0, 6000),
            labelIds: [],
            sourceUrl: a.alternateLink || course.alternateLink,
          } as EmailMessage & { sourceUrl?: string });
        }
      } catch (e) {
        console.warn(`Could not load announcements for course ${course.id}:`, e);
      }
    })
  );
  out.sort((x, y) => (y.dateISO || '').localeCompare(x.dateISO || ''));
  return out.slice(0, 30);
}
