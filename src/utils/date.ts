export function getCalendarWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  
  return {
    week: weekNo,
    year: d.getUTCFullYear()
  };
}

export function formatCalendarWeek(week: number, year: number): string {
  return `Week ${week}, ${year}`;
}

export function getWeekDateRange(week: number, year: number): { start: Date; end: Date } {
  const january1st = new Date(year, 0, 1);
  const dayOfWeek = january1st.getDay();
  
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const firstMonday = new Date(year, 0, 1 + daysToMonday);
  
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { start: weekStart, end: weekEnd };
}

export function sortNotesByCreationDate(notes: Array<{ createdAt: Date }>): Array<{ createdAt: Date }> {
  return [...notes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export interface NotesGroupedByWeek<T extends { createdAt: Date }> {
  week: number;
  year: number;
  weekLabel: string;
  notes: T[];
}

export function groupNotesByCalendarWeek<T extends { createdAt: Date }>(notes: T[]): NotesGroupedByWeek<T>[] {
  const sortedNotes = sortNotesByCreationDate(notes) as T[];
  
  const groupedMap = new Map<string, NotesGroupedByWeek<T>>();
  
  for (const note of sortedNotes) {
    const { week, year } = getCalendarWeek(note.createdAt);
    const key = `${year}-${week}`;
    
    if (!groupedMap.has(key)) {
      groupedMap.set(key, {
        week,
        year,
        weekLabel: formatCalendarWeek(week, year),
        notes: []
      });
    }
    
    groupedMap.get(key)!.notes.push(note);
  }
  
  return Array.from(groupedMap.values()).sort((a, b) => {
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return b.week - a.week;
  });
}