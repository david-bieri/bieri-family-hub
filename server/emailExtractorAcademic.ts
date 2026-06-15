/**
 * server/emailExtractorAcademic.ts
 * Homeschool Module — Email Extraction Extension
 *
 * Extends the main hub's emailExtractor.ts to handle academic progress emails
 * from EdTech platforms (Khan Academy, IXL, Math Academy, etc.) and convert
 * them into structured academic_progress records.
 *
 * INTEGRATION PATTERN:
 *   This module exports a function that can be called from the main hub's
 *   email extraction pipeline. It handles the #SCHOOL tag fast-path and
 *   provides specialized LLM prompts for academic email parsing.
 *
 * SUPPORTED SOURCES:
 *   - Khan Academy weekly progress reports
 *   - IXL parent reports
 *   - Math Academy progress emails
 *   - Time4Learning activity reports
 *   - Generic "#SCHOOL @Child" tagged emails/SMS
 *   - Portfolio quick-add via SMS: "@Cole #SCHOOL Finished science lab"
 *
 * SMS QUICK-ADD SYNTAX:
 *   @Cole #SCHOOL Math: completed fractions unit 45min
 *   @Airlie #SCHOOL Reading: Charlotte's Web ch 5-7
 *   @Cole @Airlie #SCHOOL Field trip to science museum [photo attached]
 */

import { nanoid } from "nanoid";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AcademicExtractedItem {
  id: string;
  child_id: string;
  subject_name?: string;
  date: string;
  // Progress metrics
  duration_min?: number;
  lessons_done?: number;
  mastery_score?: string;
  skills_mastered?: string[];
  // Content
  title: string;
  notes?: string;
  // Source tracking
  source: 'email_extract' | 'sms';
  source_ref: string;
  confidence: 'high' | 'medium' | 'low';
  // Portfolio artifact (if attachment detected)
  has_attachment?: boolean;
  artifact_type?: string;
}

// ─── Platform Detection ──────────────────────────────────────────────────────

interface PlatformRule {
  name: string;
  pattern: RegExp;
  parser: (body: string, childHint?: string[]) => Partial<AcademicExtractedItem>[];
}

const PLATFORM_RULES: PlatformRule[] = [
  {
    name: 'Khan Academy',
    pattern: /khanacademy\.org|khan\s*academy|weekly\s*progress\s*report/i,
    parser: parseKhanAcademyEmail,
  },
  {
    name: 'IXL',
    pattern: /ixl\.com|ixl\s*learning|ixl\s*parent\s*report/i,
    parser: parseIXLEmail,
  },
  {
    name: 'Math Academy',
    pattern: /mathacademy\.com|math\s*academy/i,
    parser: parseMathAcademyEmail,
  },
  {
    name: 'Time4Learning',
    pattern: /time4learning|t4l\s*activity/i,
    parser: parseTime4LearningEmail,
  },
];

// ─── Main Extraction Function ────────────────────────────────────────────────

/**
 * Attempts to extract academic progress items from an email.
 * Returns null if the email is not academic-related.
 */
export function extractAcademicItems(
  subject: string,
  body: string,
  fromAddress: string,
  childHints: string[],
  date?: string,
): AcademicExtractedItem[] | null {
  const today = date || new Date().toISOString().split('T')[0];

  // 1. Check if this is a known EdTech platform email
  for (const rule of PLATFORM_RULES) {
    if (rule.pattern.test(fromAddress) || rule.pattern.test(subject) || rule.pattern.test(body.slice(0, 500))) {
      const partials = rule.parser(body, childHints);
      return partials.map(p => ({
        id: nanoid(),
        child_id: p.child_id || childHints[0] || 'unknown',
        subject_name: p.subject_name,
        date: p.date || today,
        duration_min: p.duration_min,
        lessons_done: p.lessons_done,
        mastery_score: p.mastery_score,
        skills_mastered: p.skills_mastered,
        title: p.title || `${rule.name} progress`,
        notes: p.notes,
        source: 'email_extract',
        source_ref: subject,
        confidence: 'medium',
      }));
    }
  }

  // 2. Check for #SCHOOL tag in subject (fast-path from main extractor)
  if (/#SCHOOL/i.test(subject)) {
    return parseSchoolTagMessage(subject, body, childHints, today);
  }

  // 3. Not an academic email
  return null;
}

// ─── SMS Quick-Add Parser ────────────────────────────────────────────────────

/**
 * Parses SMS quick-add messages for academic progress.
 * Format: "@Cole #SCHOOL Math: completed fractions unit 45min"
 */
export function parseAcademicSMS(
  message: string,
  childHints: string[],
): AcademicExtractedItem | null {
  if (!/#SCHOOL/i.test(message)) return null;

  const today = new Date().toISOString().split('T')[0];

  // Extract subject and description
  const cleaned = message
    .replace(/#[A-Za-z]+/g, '')
    .replace(/@[A-Za-z]+/g, '')
    .trim();

  // Try to parse "Subject: description" format
  const colonMatch = cleaned.match(/^([^:]+):\s*(.+)$/);
  const subjectName = colonMatch ? colonMatch[1].trim() : undefined;
  const description = colonMatch ? colonMatch[2].trim() : cleaned;

  // Extract duration if mentioned (e.g., "45min", "1hr", "1.5 hours")
  const durationMatch = description.match(/(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?|hr|hours?)/i);
  const duration = durationMatch
    ? durationMatch[0].includes('hr') || durationMatch[0].includes('hour')
      ? Math.round(parseFloat(durationMatch[1]) * 60)
      : parseInt(durationMatch[1])
    : undefined;

  // Check for photo/attachment indicator
  const hasAttachment = /\[photo|attached|attachment|image\]/i.test(message);

  return {
    id: nanoid(),
    child_id: childHints[0] || 'unknown',
    subject_name: subjectName,
    date: today,
    duration_min: duration,
    title: description.replace(/\d+\s*(?:min(?:utes?)?|hr|hours?)/i, '').trim() || description,
    notes: undefined,
    source: 'sms',
    source_ref: message.slice(0, 100),
    confidence: 'high',
    has_attachment: hasAttachment,
    artifact_type: hasAttachment ? 'photo' : undefined,
  };
}

// ─── Platform-Specific Parsers ───────────────────────────────────────────────

function parseKhanAcademyEmail(body: string, childHints?: string[]): Partial<AcademicExtractedItem>[] {
  const items: Partial<AcademicExtractedItem>[] = [];

  // Khan Academy weekly reports typically include:
  // - Minutes spent
  // - Skills practiced/mastered
  // - Courses/units worked on

  // Extract time spent
  const timeMatch = body.match(/(\d+)\s*(?:minutes?|mins?)\s*(?:spent|of\s*learning|this\s*week)/i);
  const minutes = timeMatch ? parseInt(timeMatch[1]) : undefined;

  // Extract skills mastered
  const skillsSection = body.match(/skills?\s*(?:mastered|completed|earned)[:\s]*([\s\S]*?)(?:\n\n|\r\n\r\n|$)/i);
  const skills = skillsSection
    ? skillsSection[1].split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 100)
    : undefined;

  // Extract courses/subjects mentioned
  const courseMatch = body.match(/(?:course|subject|unit|topic)[:\s]*([^\n]+)/gi);
  const subjects = courseMatch
    ? courseMatch.map(m => m.replace(/(?:course|subject|unit|topic)[:\s]*/i, '').trim())
    : ['General'];

  for (const subject of subjects.slice(0, 5)) {
    items.push({
      child_id: childHints?.[0],
      subject_name: subject,
      duration_min: minutes ? Math.round(minutes / subjects.length) : undefined,
      skills_mastered: skills,
      title: `Khan Academy: ${subject}`,
      notes: `Weekly progress report`,
    });
  }

  if (items.length === 0) {
    items.push({
      child_id: childHints?.[0],
      subject_name: 'General',
      duration_min: minutes,
      skills_mastered: skills,
      title: 'Khan Academy weekly progress',
    });
  }

  return items;
}

function parseIXLEmail(body: string, childHints?: string[]): Partial<AcademicExtractedItem>[] {
  const items: Partial<AcademicExtractedItem>[] = [];

  // IXL reports include SmartScore, time, and skills
  const timeMatch = body.match(/(\d+)\s*(?:minutes?|mins?)/i);
  const scoreMatch = body.match(/(?:smart\s*score|score)[:\s]*(\d+)/i);
  const questionsMatch = body.match(/(\d+)\s*(?:questions?|problems?)\s*(?:answered|completed)/i);

  // Try to find subject areas
  const subjectMatches = body.match(/(?:math|language\s*arts|science|social\s*studies|reading|writing)/gi);
  const subjects = subjectMatches ? [...new Set(subjectMatches.map(s => s.trim()))] : ['General'];

  for (const subject of subjects) {
    items.push({
      child_id: childHints?.[0],
      subject_name: subject,
      duration_min: timeMatch ? parseInt(timeMatch[1]) : undefined,
      mastery_score: scoreMatch ? `SmartScore: ${scoreMatch[1]}` : undefined,
      lessons_done: questionsMatch ? parseInt(questionsMatch[1]) : undefined,
      title: `IXL: ${subject}`,
    });
  }

  return items.length > 0 ? items : [{
    child_id: childHints?.[0],
    subject_name: 'General',
    duration_min: timeMatch ? parseInt(timeMatch[1]) : undefined,
    title: 'IXL progress report',
  }];
}

function parseMathAcademyEmail(body: string, childHints?: string[]): Partial<AcademicExtractedItem>[] {
  // Math Academy reports focus on:
  // - XP earned
  // - Topics mastered
  // - Time spent
  // - Current course progress percentage

  const timeMatch = body.match(/(\d+)\s*(?:minutes?|mins?|hours?)/i);
  const xpMatch = body.match(/(\d+)\s*(?:XP|experience\s*points?)/i);
  const topicsMatch = body.match(/(\d+)\s*(?:topics?|lessons?)\s*(?:mastered|completed)/i);
  const progressMatch = body.match(/(\d+(?:\.\d+)?)\s*%\s*(?:complete|progress|through)/i);

  const duration = timeMatch
    ? timeMatch[0].toLowerCase().includes('hour')
      ? parseInt(timeMatch[1]) * 60
      : parseInt(timeMatch[1])
    : undefined;

  return [{
    child_id: childHints?.[0],
    subject_name: 'Mathematics',
    duration_min: duration,
    lessons_done: topicsMatch ? parseInt(topicsMatch[1]) : undefined,
    mastery_score: progressMatch ? `${progressMatch[1]}% course progress` : xpMatch ? `${xpMatch[1]} XP` : undefined,
    title: 'Math Academy progress',
    notes: body.slice(0, 200),
  }];
}

function parseTime4LearningEmail(body: string, childHints?: string[]): Partial<AcademicExtractedItem>[] {
  const items: Partial<AcademicExtractedItem>[] = [];

  // Time4Learning reports include lessons completed per subject
  const lessonMatches = body.matchAll(/([A-Za-z\s]+):\s*(\d+)\s*(?:lessons?|activities?)\s*completed/gi);

  for (const match of lessonMatches) {
    items.push({
      child_id: childHints?.[0],
      subject_name: match[1].trim(),
      lessons_done: parseInt(match[2]),
      title: `Time4Learning: ${match[1].trim()}`,
    });
  }

  if (items.length === 0) {
    const totalMatch = body.match(/(\d+)\s*(?:total\s*)?(?:lessons?|activities?)/i);
    items.push({
      child_id: childHints?.[0],
      subject_name: 'General',
      lessons_done: totalMatch ? parseInt(totalMatch[1]) : undefined,
      title: 'Time4Learning activity report',
    });
  }

  return items;
}

// ─── Generic #SCHOOL Tag Parser ──────────────────────────────────────────────

function parseSchoolTagMessage(
  subject: string,
  body: string,
  childHints: string[],
  date: string,
): AcademicExtractedItem[] {
  // Clean subject line
  const cleaned = subject
    .replace(/#[A-Za-z]+/g, '')
    .replace(/@[A-Za-z]+/g, '')
    .trim();

  // Try to detect subject and duration from the cleaned text
  const colonMatch = cleaned.match(/^([^:]+):\s*(.+)$/);
  const subjectName = colonMatch ? colonMatch[1].trim() : undefined;
  const description = colonMatch ? colonMatch[2].trim() : cleaned;

  const durationMatch = (cleaned + ' ' + body).match(/(\d+)\s*(?:min(?:utes?)?|hr|hours?)/i);
  const duration = durationMatch
    ? durationMatch[0].includes('hr') || durationMatch[0].includes('hour')
      ? Math.round(parseFloat(durationMatch[1]) * 60)
      : parseInt(durationMatch[1])
    : undefined;

  // Create one item per mentioned child
  const children = childHints.length > 0 ? childHints : ['unknown'];

  return children.map(child_id => ({
    id: nanoid(),
    child_id,
    subject_name: subjectName,
    date,
    duration_min: duration,
    title: description || cleaned || 'Academic activity',
    notes: body ? body.slice(0, 500) : undefined,
    source: 'email_extract' as const,
    source_ref: subject,
    confidence: 'high' as const,
  }));
}

// ─── LLM Prompt for Academic Emails ──────────────────────────────────────────

/**
 * Returns the system prompt to use when the main emailExtractor falls through
 * to LLM parsing for an academic email. This provides context about the
 * homeschool setup so the LLM can extract structured progress data.
 */
export function getAcademicLLMPrompt(): string {
  return `You are an AI assistant for a homeschooling family (the Bieris). The family homeschools 4 children:
- Cole (age 14, 8th grade level)
- Greta (age 12, 7th grade level)
- Airlie (age 11, 5th grade level)
- Clara (age 9, 4th grade level)

They use various EdTech platforms including Khan Academy, IXL, Math Academy, Time4Learning, and Outschool.

When parsing academic emails, extract:
1. Which child(ren) the email is about
2. Which subject(s) were studied
3. Time spent (in minutes)
4. Lessons/units completed (count)
5. Mastery scores or progress percentages
6. Specific skills mastered (as an array)
7. Any upcoming assignments or deadlines

Return a JSON array of objects with these fields:
{
  "child_id": "cole|greta|airlie|clara",
  "subject_name": "Mathematics|Science|English|History|...",
  "duration_min": number|null,
  "lessons_done": number|null,
  "mastery_score": "string description"|null,
  "skills_mastered": ["skill1", "skill2"]|null,
  "title": "Brief description of what was accomplished",
  "notes": "Any additional context"
}

If you cannot determine a field, use null. Always return valid JSON.`;
}
