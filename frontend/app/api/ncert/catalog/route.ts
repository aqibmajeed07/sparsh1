import { NextResponse } from 'next/server';
import { NCERT_CBSE_LESSONS } from '@/lib/ncert-syllabus';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

function buildFallbackCatalog() {
  const catalog: Record<string, Record<string, Record<string, any[]>>> = {};

  // Standard Class 1 to 12 structure
  const classGrades = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12'];

  classGrades.forEach(cls => {
    catalog[cls] = {};
  });

  // Populate from NCERT_CBSE_LESSONS
  NCERT_CBSE_LESSONS.forEach((lesson, idx) => {
    const clsName = `Class ${lesson.grade}`;
    const subjName = lesson.subject || 'General Science';
    const bookName = `${subjName} NCERT Textbook`;

    if (!catalog[clsName]) catalog[clsName] = {};
    if (!catalog[clsName][subjName]) catalog[clsName][subjName] = {};
    if (!catalog[clsName][subjName][bookName]) catalog[clsName][subjName][bookName] = [];

    catalog[clsName][subjName][bookName].push({
      id: `builtin::${clsName}::${subjName}::${lesson.chapter}::${lesson.title}`,
      file_name: `${lesson.chapter.replace(/\s+/g, '_')}_${lesson.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
      title: `${lesson.chapter}: ${lesson.title}`,
      path: `builtin://${clsName}/${subjName}/${idx}`,
      class: clsName,
      subject: subjName,
      book: bookName,
      description: lesson.description,
      accessible_summary: lesson.accessible_summary,
      tags: lesson.tags,
      transcript_text: lesson.transcript_text,
    });
  });

  // Add foundational chapters for primary classes (1-5) if empty
  const primarySubjects: Record<string, { subjects: Record<string, string[]> }> = {
    'Class 1': {
      subjects: {
        'English': ['Raindrops Chapter 1: Clap Clap Clap', 'Raindrops Chapter 2: One Two Three', 'Raindrops Chapter 3: The Little Bird'],
        'Mathematics': ['Math-Magic Chapter 1: Shapes and Space', 'Math-Magic Chapter 2: Numbers from One to Nine'],
        'Hindi': ['Rimjhim Chapter 1: Jhula', 'Rimjhim Chapter 2: Aam Ki Kahani'],
      }
    },
    'Class 2': {
      subjects: {
        'English': ['Raindrops Chapter 1: Action Song', 'Raindrops Chapter 2: Our Day'],
        'Mathematics': ['Math-Magic Chapter 1: What is Long, What is Round?', 'Math-Magic Chapter 2: Counting in Groups'],
      }
    },
    'Class 3': {
      subjects: {
        'English': ['Marigold Chapter 1: Good Morning', 'Marigold Chapter 2: The Magic Garden'],
        'Mathematics': ['Math-Magic Chapter 1: Where to Look From', 'Math-Magic Chapter 2: Fun with Numbers'],
        'Environmental Studies': ['Looking Around Chapter 1: Poonam’s Day Out', 'Looking Around Chapter 2: The Plant Fairy'],
      }
    },
    'Class 4': {
      subjects: {
        'Environmental Studies': ['Looking Around Chapter 1: Going to School', 'Looking Around Chapter 2: Ear to Ear'],
        'Mathematics': ['Math-Magic Chapter 1: Building with Bricks', 'Math-Magic Chapter 2: Long and Short'],
      }
    },
    'Class 5': {
      subjects: {
        'Environmental Studies': ['Looking Around Chapter 1: Super Senses', 'Looking Around Chapter 2: A Snake Charmer’s Story'],
        'Mathematics': ['Math-Magic Chapter 1: The Fish Tale', 'Math-Magic Chapter 2: Shapes and Angles'],
      }
    }
  };

  Object.entries(primarySubjects).forEach(([cls, data]) => {
    Object.entries(data.subjects).forEach(([subj, chaps]) => {
      const bookName = `${subj} NCERT Textbook`;
      if (!catalog[cls]) catalog[cls] = {};
      if (!catalog[cls][subj]) catalog[cls][subj] = {};
      if (!catalog[cls][subj][bookName]) catalog[cls][subj][bookName] = [];

      chaps.forEach((chapTitle, cIdx) => {
        catalog[cls][subj][bookName].push({
          id: `builtin::${cls}::${subj}::chap${cIdx + 1}`,
          file_name: `${chapTitle.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          title: chapTitle,
          path: `builtin://${cls}/${subj}/p${cIdx + 1}`,
          class: cls,
          subject: subj,
          book: bookName,
          description: `NCERT Primary curriculum accessible study unit for ${cls} ${subj}.`,
          accessible_summary: `Introduction and foundational concepts in ${subj} designed for inclusive visual and tactile learning.`,
          tags: ['NCERT Primary', 'Accessible Audio', 'ISL Ready'],
          transcript_text: `Welcome to ${chapTitle}. In this lesson we explore essential foundational concepts.`,
        });
      });
    });
  });

  return catalog;
}

export async function GET() {
  try {
    // 1. Try to fetch dynamic catalog from the backend
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${BACKEND_URL}/api/ncert/catalog`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && data.catalog && Object.keys(data.catalog).length > 0) {
        // Merge with any missing standard classes to guarantee full coverage
        const fallback = buildFallbackCatalog();
        const mergedCatalog = { ...fallback, ...data.catalog };
        return NextResponse.json({ status: 'success', catalog: mergedCatalog });
      }
    }
  } catch (err) {
    // Backend offline or unreachable from this network context
    console.warn('[NCERT API Proxy] Backend catalog unreachable, using rich fallback catalog');
  }

  // 2. Return rich built-in NCERT catalog
  return NextResponse.json({
    status: 'success',
    catalog: buildFallbackCatalog(),
  });
}
