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
    
    // Prepare notes content for OpenAI
    const notesContent = notesWithDates.map((note) => {
      const createdDate = new Date(note.createdAt).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      return `Date: ${createdDate}\nContent: ${note.content}\n---`;
    }).join('\n\n');

    // Create OpenAI prompt specifically for hours extraction
    const prompt = `Extract all worker hours from the following notes and create a MATRIX/GRID style HTML table.

CRITICAL REQUIREMENTS:
1. Create a MATRIX table with:
   - Worker names in the LEFTMOST column (one row per worker)
   - Days of the month as COLUMN HEADERS across the top
   - Work hours in the cells where worker and date intersect
2. Format: Show hours as "HH:MM-HH:MM (Xh)" where X is total hours worked
3. Empty cells for days where a worker didn't work
4. Sort workers alphabetically, dates chronologically
5. Language: Use the same language as the input notes

TABLE STRUCTURE EXAMPLE:
<table class="hours-table">
<thead>
<tr>
  <th>Arbeiter</th>
  <th>Mo. 15.01</th>
  <th>Di. 16.01</th>
  <th>Mi. 17.01</th>
  <th>Do. 18.01</th>
  <th>Fr. 19.01</th>
</tr>
</thead>
<tbody>
<tr>
  <td><strong>Besim</strong></td>
  <td>07:00-17:00 (9h)</td>
  <td>07:00-16:00 (8h)</td>
  <td></td>
  <td>07:00-17:00 (9h)</td>
  <td></td>
</tr>
<tr>
  <td><strong>Ion</strong></td>
  <td>07:00-17:00 (9h)</td>
  <td></td>
  <td>08:00-17:00 (8h)</td>
  <td>07:00-17:00 (9h)</td>
  <td>07:00-15:00 (7h)</td>
</tr>
</tbody>
</table>

ADDITIONAL ROWS TO ADD AFTER ALL WORKERS:
- Add a summary row showing total hours per day
- Add a row showing total hours per worker

HTML FORMAT:
- Return ONLY the HTML table
- Use class="hours-table" for styling
- Bold worker names
- Use abbreviated day names (Mo., Di., Mi., etc. for German)
- Calculate hours: End - Start - 1h break (unless specified otherwise)

Notes content:
${notesContent}

IMPORTANT: Create a MATRIX view where you can see all workers and all days at a glance. Each worker gets ONE row, each day gets ONE column.`;

    console.log('Calling OpenAI API for hours extraction');
    
    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openAIApiKey}`,
      },
      body: JSON.stringify({
        model: 'o3-2025-04-16',
        messages: [
          {
            role: 'system',
            content: 'You are a specialist in extracting worker hours from construction notes. Extract ALL worker hours and create a single consolidated HTML table. Each row should show: Date, Worker Name, Start Time, End Time, Break Time, Total Hours Worked. Calculate hours as: End - Start - Break. Sort by date then by worker name. Use the same language as the input notes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
      }),
    });

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
            margin: 15mm;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        
        h1 {
            color: #2563eb;
            font-size: 24px;
            margin-bottom: 10px;
            text-align: center;
        }
        
        .subtitle {
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 20px;
        }
        
        .hours-table {
            width: 100%;
            border-collapse: collapse;
            margin: 0 auto;
            background-color: white;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .hours-table thead {
            background-color: #f3f4f6;
        }
        
        .hours-table th,
        .hours-table td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
        }
        
        .hours-table th {
            font-weight: bold;
            color: #374151;
            background-color: #f3f4f6;
        }
        
        .hours-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        .hours-table tbody tr:hover {
            background-color: #f3f4f6;
        }
        
        .hours-table td:nth-child(3),
        .hours-table td:nth-child(4),
        .hours-table td:nth-child(5),
        .hours-table td:nth-child(6) {
            text-align: center;
            font-family: monospace;
            font-size: 14px;
        }
        
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
        }
        
        @media print {
            body { 
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
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