import { NextRequest, NextResponse } from 'next/server';
import { Note } from '@/types';
import { chromium } from 'playwright';

export async function POST(request: NextRequest) {
  try {
    console.log('Worker hours PDF generation request received');
    const { notes, projectTitle } = await request.json();
    
    console.log('Request data:', { notesCount: notes?.length, projectTitle });
    
    if (!notes || notes.length === 0) {
      console.error('No notes provided');
      return NextResponse.json({ error: 'No notes provided' }, { status: 400 });
    }

    const openAIApiKey = process.env.OPENAI_API_KEY;
    if (!openAIApiKey) {
      console.error('OpenAI API key not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    // Convert date strings to Date objects and sort by date
    const notesWithDates: Note[] = notes.map((note: Note) => ({
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt)
    })).sort((a: Note, b: Note) => a.createdAt.getTime() - b.createdAt.getTime());
    
    // Extract full note content for each day to preserve ALL worker information
    const notesForAI: string[] = [];
    
    notesWithDates.forEach((note) => {
      const date = new Date(note.createdAt);
      const day = date.getDate();
      const month = date.getMonth() + 1;
      
      // Include the full note content so AI can see everything
      notesForAI.push(`=== Day ${day} (${date.toLocaleDateString('de-DE')}) ===\n${note.content}\n`);
    });
    
    // If no notes found, return early
    if (notesForAI.length === 0) {
      return NextResponse.json({ error: 'No notes found' }, { status: 400 });
    }
    
    console.log(`Processing ${notesForAI.length} days of notes`);
    const notesContent = notesForAI.join('\n');

    // Create simplified prompt
    const prompt = `Analyze these daily construction notes and create a worker hours table:

${notesContent}

CRITICAL PARSING INSTRUCTIONS:
1. Extract EVERY worker name mentioned in the notes
2. Common patterns to look for:
   - "Name1/Name2/Name3: 07:00-17:00" = ALL these workers worked 07:00-17:00
   - "Name1, Name2, Name3: 7-17" = ALL these workers worked 7-17
   - "Arbeiter: Name1, Name2..." = list of workers
   - Individual mentions like "Name bis 16:00" = that person left at 16:00
3. Calculate hours: 
   - 07:00-17:00 = 10 hours - 1 hour break = 9 hours
   - 07:00-16:00 = 9 hours - 1 hour break = 8 hours
   - 07:00-12:00 = 5 hours (no break for half day) = 5 hours

IMPORTANT RULES:
- When multiple names appear before a time (separated by /, comma, or "und"), they ALL worked those hours
- Look for ALL worker names in the entire note, not just obvious patterns
- Include workers even if they're mentioned in sentences like "Today Name1 and Name2 worked..."

TABLE FORMAT:
- Rows: Each unique worker name (alphabetically sorted)
- Columns: Days 1-31
- Cells: Number of hours worked (e.g., "9", "8", "5")
- Use "-" for days not worked
- Right column "Gesamt": total hours per worker
- Bottom row: daily totals

Return ONLY the <table class="hours-table">...</table> HTML.`;

    console.log('Calling OpenAI API for hours extraction');
    
    // Call OpenAI API with longer timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 3 minute timeout
    
    let openAIResponse;
    try {
      openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14', // Using gpt-4.1 model
          messages: [
            {
              role: 'system',
              content: 'You are parsing construction worker hours. CRITICAL: When multiple workers share one time entry (e.g., "A/B/C: 7-17"), ALL listed workers worked those hours. Watch for exceptions like "bis 16:00" (until 4pm) or "ab 8:00" (from 8am). Show ONLY hour numbers in cells. Calculate: 7-17 = 9h (with 1h break). Return only HTML table.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0, // Zero temperature for deterministic output
          max_tokens: 2000, // Using max_tokens for this model
        }),
        signal: controller.signal,
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('OpenAI API request timed out after 3 minutes');
        throw new Error('Request timed out - try selecting fewer notes');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API Error:', errorText);
      throw new Error(`OpenAI API Error: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const tableHTML = openAIData.choices[0].message.content;

    // Create HTML content for landscape PDF
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle} - Arbeitsstunden</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 10mm;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.2;
            color: #000;
            margin: 0;
            padding: 10px;
            font-size: 11px;
        }
        
        h1 {
            font-size: 18px;
            margin-bottom: 5px;
            text-align: center;
            color: #000;
        }
        
        .subtitle {
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-bottom: 15px;
        }
        
        .week-section {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        
        .week-section h3 {
            font-size: 14px;
            margin-bottom: 8px;
            color: #000;
            background-color: #e5e7eb;
            padding: 5px 10px;
            border-radius: 3px;
        }
        
        .hours-table {
            width: 100%;
            border-collapse: collapse;
            background-color: white;
            border: 2px solid #000;
        }
        
        .hours-table th,
        .hours-table td {
            border: 1px solid #666;
            padding: 4px 6px;
            text-align: center;
        }
        
        .hours-table th {
            font-weight: bold;
            background-color: #e5e7eb;
            font-size: 10px;
        }
        
        .worker-col {
            width: 120px;
            text-align: left !important;
        }
        
        .day-col {
            width: 35px;
            font-size: 9px;
        }
        
        .total-col {
            width: 70px;
            background-color: #f3f4f6;
            font-weight: bold;
        }
        
        .worker-name {
            text-align: left !important;
            font-weight: bold;
        }
        
        .hours {
            font-size: 9px;
            font-weight: normal;
            padding: 1px;
            white-space: nowrap;
        }
        
        .total {
            background-color: #f3f4f6;
            font-weight: bold;
            font-size: 12px;
        }
        
        .totals-row {
            background-color: #e5e7eb !important;
        }
        
        .totals-row td {
            border-top: 2px solid #000;
        }
        
        .summary-section {
            margin-top: 30px;
            page-break-before: always;
        }
        
        .summary-section h3 {
            font-size: 16px;
            margin-bottom: 10px;
        }
        
        .summary-table {
            width: 60%;
            margin: 0 auto;
            border-collapse: collapse;
            border: 2px solid #000;
        }
        
        .summary-table th,
        .summary-table td {
            border: 1px solid #666;
            padding: 8px 12px;
            text-align: center;
        }
        
        .summary-table th {
            background-color: #e5e7eb;
            font-weight: bold;
        }
        
        .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        
        @media print {
            body { 
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .week-section {
                page-break-inside: avoid;
            }
        }
    </style>
</head>
<body>
    <h1>${projectTitle} - Arbeitsstunden</h1>
    <div class="subtitle">
        Erstellt am: ${new Date().toLocaleDateString('de-DE', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}
    </div>
    
    ${tableHTML}
    
    <div class="footer">
        Automatisch generiert aus ${notes.length} Notizen
    </div>
</body>
</html>`;

    console.log('Generating PDF with Playwright');
    
    // Generate PDF using Playwright
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      },
      printBackground: true
    });
    
    await browser.close();
    console.log('Worker hours PDF generated successfully');

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${projectTitle}_arbeitsstunden_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating worker hours PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate worker hours PDF' },
      { status: 500 }
    );
  }
}