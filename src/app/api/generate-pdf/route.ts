import { NextRequest, NextResponse } from 'next/server';
import { Note } from '@/types';
import puppeteer from 'puppeteer';
import { getCalendarWeek, formatCalendarWeek, groupNotesByCalendarWeek } from '@/utils/date';

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
    const notesWithDates = notes.map(note => ({
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

SPECIAL INSTRUCTIONS:
- If notes contain worker hours/time entries (like "Besim/ Ion/ Sascha: 07:00 - 17:00"), format these as tables
- Group images by note - show all images for a note together, not one per page
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
              content: 'You are a professional document summarizer specialized in construction project reports. CRITICAL: Always respond in the SAME LANGUAGE as the input notes (German notes = German response, English notes = English response). Create clear, well-structured HTML summaries organized by calendar weeks. Group images by note (not one per page). Format worker hours as HTML tables. Show creation dates for each note. Focus on progress, milestones, and key activities while maintaining the original language and terminology.'
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
        } catch (e) {
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

    console.log('Starting HTML to PDF generation');
    
    // Create complete HTML document
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectTitle} - Project Summary</title>
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
        
        h3 {
            color: #374151;
            margin-top: 25px;
            margin-bottom: 10px;
            font-size: 16px;
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
            background-color: #eff6ff;
            border: 2px solid #3b82f6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .summary-section h2 {
            color: #1e40af;
            margin-top: 0;
        }
        
        .week-section {
            margin-bottom: 40px;
            padding: 25px;
            background-color: #f8fafc;
            border-radius: 10px;
            border-left: 5px solid #3b82f6;
        }
        
        .week-header {
            color: #1e40af;
            font-size: 22px;
            font-weight: bold;
            margin-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
        }
        
        .note-entry {
            margin-bottom: 25px;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .note-header {
            margin-bottom: 15px;
        }
        
        .note-title {
            color: #374151;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .note-date {
            color: #6b7280;
            font-size: 14px;
            font-style: italic;
        }
        
        .note-section {
            margin-bottom: 30px;
            padding: 20px;
            background-color: #f9fafb;
            border-radius: 8px;
            border-left: 4px solid #6b7280;
        }
        
        .image-group {
            margin: 15px 0;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
        }
        
        .image-group img {
            width: 100%;
            height: auto;
            max-height: 200px;
            object-fit: cover;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .hours-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            background-color: white;
            border-radius: 6px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .hours-table th,
        .hours-table td {
            border: 1px solid #d1d5db;
            padding: 10px 15px;
            text-align: left;
        }
        
        .hours-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            color: #374151;
        }
        
        img {
            max-width: 100%;
            height: auto;
            margin: 5px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .tag {
            display: inline-block;
            background-color: #dbeafe;
            color: #1e40af;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            margin: 2px;
        }
        
        @media print {
            body { print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>${projectTitle} - Project Summary</h1>
    
    <div class="meta-info">
        Generated on: ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}<br>
        Total notes: ${notes.length}
    </div>
    
    ${summary}
    
</body>
</html>`;

    console.log('HTML content created, length:', htmlContent.length);
    
    // Generate PDF using Puppeteer
    console.log('Launching Puppeteer...');
    let browser;
    
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      console.log('Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '20mm',
          right: '20mm',
          bottom: '20mm',
          left: '20mm'
        },
        printBackground: true,
        timeout: 30000
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
      
    } catch (puppeteerError) {
      console.error('Puppeteer error:', puppeteerError);
      
      if (browser) {
        await browser.close().catch(console.error);
      }
      
      // Fallback: return HTML for manual PDF generation
      console.log('Falling back to HTML response due to Puppeteer error');
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${projectTitle}_summary_${new Date().toISOString().split('T')[0]}.html"`,
        },
      });
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF summary' },
      { status: 500 }
    );
  }
}