import { NextRequest, NextResponse } from 'next/server';
import { Note } from '@/types';
import { groupNotesByCalendarWeek } from '@/utils/date';
import { chromium } from 'playwright';

export async function POST(request: NextRequest) {
  try {
    console.log('PDF generation request received');
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
    
    console.log('OpenAI API key found:', openAIApiKey.substring(0, 10) + '...');

    // Convert date strings to Date objects
    const notesWithDates: Note[] = notes.map((note: Note) => ({
      ...note,
      createdAt: new Date(note.createdAt),
      updatedAt: new Date(note.updatedAt)
    }));
    
    // Group notes by calendar week and format for OpenAI
    const groupedNotes = groupNotesByCalendarWeek(notesWithDates);
    
    const notesContent = groupedNotes.map((group) => {
      let weekContent = `CALENDAR WEEK: ${group.weekLabel}\n\n`;
      
      group.notes.forEach((note) => {
        const createdDate = new Date(note.createdAt).toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric', 
          month: 'long',
          day: 'numeric'
        });
        
        weekContent += `Note Title: ${note.title}\n`;
        weekContent += `Created: ${createdDate}\n`;
        weekContent += `Content: ${note.content}\n`;
        
        if (note.tags && note.tags.length > 0) {
          weekContent += `Tags: ${note.tags.join(', ')}\n`;
        }
        
        if (note.images && note.images.length > 0) {
          weekContent += `Images (${note.images.length} total for this note):\n`;
          note.images.forEach((image, index) => {
            if (image.url) {
              weekContent += `  - Image ${index + 1}: ${image.name} (URL: ${image.url})\n`;
            } else if (image.data) {
              weekContent += `  - Image ${index + 1}: ${image.name} (base64 data available)\n`;
            }
          });
        }
        
        weekContent += `\n---\n\n`;
      });
      
      return weekContent;
    }).join('\n=== END OF WEEK ===\n\n');

    // Create OpenAI prompt
    const prompt = `Please create a comprehensive summary of the following notes from the project "${projectTitle}".

CRITICAL LANGUAGE REQUIREMENT:
- ALWAYS write your summary in the SAME LANGUAGE as the input notes
- If notes are in German, respond in German
- If notes are in English, respond in English
- Match the language style and terminology of the original notes

FORMATTING REQUIREMENTS:
- Return your response in clean HTML format suitable for PDF conversion
- Use proper HTML structure with headings (h1, h2, h3), paragraphs, and lists
- Structure content by calendar weeks with clear week headers
- Show creation date for each note entry
- Group images by note - if a note has multiple images, display them together under that note
- When you find hour recordings or worker time entries, format them as HTML tables with proper headers
- For any images mentioned with URLs, include them as <img> tags with the provided URLs
- Use CSS-friendly classes for styling (e.g., class="week-section", class="note-entry", class="hours-table", class="image-group")

CONTENT STRUCTURE:
1. Overall project summary at the top (in the language of the notes)
2. For each calendar week:
   - Week heading (e.g., "Kalenderwoche 25, 2025" if German notes)
   - For each note in that week:
     - Note title and creation date
     - Note content summary
     - All images for that note grouped together
     - Worker hours table if present
3. Maintain chronological order within each week

SPECIAL INSTRUCTIONS FOR WORKER HOURS:
- When you find worker time entries (like "Besim/ Ion/ Sascha: 07:00 - 17:00"), create detailed HTML tables
- IMPORTANT: Use table headers in the SAME LANGUAGE as the notes:
  * German notes: Arbeiter | Beginn | Ende | Pause | Arbeitsstunden | Bemerkungen  
  * English notes: Worker | Start | End | Break | Total Hours | Notes
- Calculate: End - Start - Break (assume 1 hour break unless specified)

EXAMPLE: If you see "Besim/ Dima/ Ion/ Sascha: 07:00 - 17:00" in German notes, create a table like:
<table class="hours-table">
<tr><th>Arbeiter</th><th>Beginn</th><th>Ende</th><th>Pause</th><th>Arbeitsstunden</th><th>Bemerkungen</th></tr>
<tr><td>Besim</td><td>07:00</td><td>17:00</td><td>1h</td><td>9h</td><td></td></tr>
<tr><td>Dima</td><td>07:00</td><td>17:00</td><td>1h</td><td>9h</td><td></td></tr>
<tr><td>Ion</td><td>07:00</td><td>17:00</td><td>1h</td><td>9h</td><td></td></tr>
<tr><td>Sascha</td><td>07:00</td><td>17:00</td><td>1h</td><td>9h</td><td></td></tr>
</table>

If English notes, use: Worker | Start | End | Break | Total Hours | Notes
If German notes, use: Arbeiter | Beginn | Ende | Pause | Arbeitsstunden | Bemerkungen

- Calculate work hours automatically: 17:00 - 07:00 = 10 hours total, minus 1 hour break = 9 hours worked
- If workers have different hours, create separate rows or tables as needed
- Use class="hours-table" for styling

OTHER FORMATTING:
- Group images by note - show all images for a note together in a two-column layout (max 300px width, 220px height)
- Wrap multiple images in a div with class="image-container" for proper spacing
- Include creation dates prominently for each note
- Highlight key milestones and progress points
- Use the exact calendar week labels provided in the input

Notes organized by calendar week:

${notesContent}

Please return only the HTML content without <!DOCTYPE>, <html>, <head>, or <body> tags - just the content that will go inside a styled HTML document.`;

    console.log('Calling OpenAI API with prompt length:', prompt.length);
    
    let openAIResponse;
    let summary;
    
    try {
      // Call OpenAI API
      openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: 'You are a professional document summarizer specialized in construction project reports. CRITICAL: Always respond in the SAME LANGUAGE as the input notes (German notes = German response, English notes = English response). Create clear, well-structured HTML summaries organized by calendar weeks. For worker hours (like "07:00 - 17:00"), create detailed tables showing: Worker Name, Start Time, End Time, Break Time (assume 1 hour), Total Hours Worked (calculate: End - Start - Break), and Notes. Group images by note (not one per page). Show creation dates for each note. Focus on progress, milestones, and key activities while maintaining the original language and terminology.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
        }),
      });

      console.log('OpenAI response status:', openAIResponse.status);
      console.log('OpenAI response headers:', Object.fromEntries(openAIResponse.headers.entries()));
      
      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('OpenAI API Error - Raw response:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
        
        console.error('OpenAI API Error:', {
          status: openAIResponse.status,
          statusText: openAIResponse.statusText,
          error: errorData
        });
        throw new Error(`OpenAI API Error: ${openAIResponse.status} - ${errorData.error?.message || errorData.message || openAIResponse.statusText}`);
      }

      const openAIData = await openAIResponse.json();
      console.log('OpenAI response received:', JSON.stringify(openAIData, null, 2));
      
      if (!openAIData.choices || openAIData.choices.length === 0) {
        throw new Error('No choices returned from OpenAI API');
      }
      
      summary = openAIData.choices[0].message.content;
      console.log('Summary generated, length:', summary?.length);
      
      if (!summary) {
        throw new Error('Empty summary returned from OpenAI API');
      }
      
    } catch (fetchError) {
      console.error('Error calling OpenAI API:', fetchError);
      throw fetchError;
    }

    console.log('Starting Playwright PDF generation');

    // Create HTML content for PDF
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle} - Projektzusammenfassung</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        h1 {
            color: #2563eb;
            border-bottom: 3px solid #e5e7eb;
            padding-bottom: 15px;
            margin-bottom: 30px;
            font-size: 28px;
        }
        
        h2 {
            color: #1f2937;
            margin-top: 35px;
            margin-bottom: 15px;
            font-size: 20px;
        }
        
        .meta-info {
            background-color: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 30px;
            font-size: 14px;
            color: #6b7280;
        }
        
        .summary-section {
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .summary-section h2 {
            color: #374151;
            margin-top: 0;
        }
        
        .week-section {
            margin-bottom: 40px;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .week-title {
            color: #374151;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        
        .note-entry {
            margin-bottom: 25px;
            padding: 15px;
            background-color: white;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        
        .note-title {
            font-size: 16px;
            font-weight: bold;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .note-date {
            font-size: 12px;
            color: #6b7280;
            font-style: italic;
            margin-bottom: 10px;
        }
        
        .note-content {
            font-size: 13px;
            line-height: 1.5;
            color: #374151;
            margin-bottom: 10px;
            white-space: pre-wrap;
        }
        
        .hours-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background-color: white;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .hours-table th,
        .hours-table td {
            border: 1px solid #d1d5db;
            padding: 8px 12px;
            text-align: left;
        }
        
        .hours-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        
        .hours-table td:nth-child(2),
        .hours-table td:nth-child(3),
        .hours-table td:nth-child(4),
        .hours-table td:nth-child(5) {
            text-align: center;
            font-family: monospace;
        }
        
        .image-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 15px 0;
        }
        
        .image-container img {
            width: 100%;
            max-width: 300px;
            height: 220px;
            object-fit: cover;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
        }
        
        .image-notice {
            font-size: 12px;
            color: #6b7280;
            font-style: italic;
            margin-top: 10px;
        }
        
        @media print {
            body { print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>${projectTitle} - Projektzusammenfassung</h1>
    
    <div class="meta-info">
        Erstellt am: ${new Date().toLocaleDateString('de-DE', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}<br>
        Anzahl Notizen: ${notes.length}
    </div>
    
    ${summary}
    
</body>
</html>`;

    console.log('HTML content created, length:', htmlContent.length);
    
    // Generate PDF using Playwright
    console.log('Launching Playwright browser...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle' });
    
    console.log('Generating PDF...');
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      printBackground: true
    });
    
    await browser.close();
    console.log('PDF generated successfully, size:', pdfBuffer.length);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${projectTitle}_summary_${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF summary' },
      { status: 500 }
    );
  }
}