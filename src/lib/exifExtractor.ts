/**
 * EXIF metadata extraction utility
 */

interface ExifData {
  dateTime?: string;
  dateTimeOriginal?: string;
  camera?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export async function extractExifFromFile(file: File): Promise<ExifData | null> {
  try {
    console.log('📷 Extracting EXIF from file:', file.name, 'type:', file.type);
    
    // Check if it's a supported image type
    const supportedTypes = ['image/jpeg', 'image/jpg'];
    
    // Note: HEIC files from iPhone often get converted to JPEG by browsers during upload
    if (!supportedTypes.some(type => file.type.includes(type))) {
      console.log('📷 Skipping EXIF extraction - file type not supported:', file.type);
      console.log('📷 Note: HEIC files from iPhone may be converted to JPEG by browser');
      return null;
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check if it's a JPEG file
    if (uint8Array[0] !== 0xFF || uint8Array[1] !== 0xD8) {
      console.log('📷 Not a valid JPEG file');
      return null;
    }

    const exifData: ExifData = {};
    
    // Look for EXIF data
    let i = 2;
    while (i < uint8Array.length - 1) {
      // Look for EXIF marker (0xFFE1)
      if (uint8Array[i] === 0xFF && uint8Array[i + 1] === 0xE1) {
        console.log('📷 Found EXIF marker at position', i);
        
        // Extract EXIF data section
        const exifLength = (uint8Array[i + 2] << 8) | uint8Array[i + 3];
        const exifDataSection = uint8Array.slice(i + 4, i + 4 + exifLength);
        const exifString = new TextDecoder('latin1').decode(exifDataSection);
        
        // Look for DateTime patterns
        const dateTimePatterns = [
          /DateTime\x00(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/,
          /DateTimeOriginal\x00(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/,
          /(\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2})/
        ];
        
        for (const pattern of dateTimePatterns) {
          const match = exifString.match(pattern);
          if (match) {
            const dateTimeStr = match[1] || match[0];
            if (pattern.source.includes('DateTimeOriginal')) {
              exifData.dateTimeOriginal = dateTimeStr;
              console.log('📷 Found DateTimeOriginal (when photo was taken):', dateTimeStr);
            } else if (!exifData.dateTime) {
              exifData.dateTime = dateTimeStr;
              console.log('📷 Found DateTime (camera date when photo was taken):', dateTimeStr);
            }
          }
        }
        
        // Look for camera model
        const cameraPatterns = [
          /Model\x00([^\x00]+)/,
          /Make\x00([^\x00]+)/
        ];
        
        for (const pattern of cameraPatterns) {
          const match = exifString.match(pattern);
          if (match) {
            const cameraInfo = match[1].trim();
            if (cameraInfo && !exifData.camera) {
              exifData.camera = cameraInfo;
              console.log('📷 Found camera info:', cameraInfo);
              break;
            }
          }
        }
        
        break;
      }
      i++;
    }
    
    // If we found any EXIF data, return it
    if (Object.keys(exifData).length > 0) {
      console.log('📷 EXIF extraction successful:', exifData);
      return exifData;
    }
    
    console.log('📷 No EXIF data found');
    return null;
  } catch (error) {
    console.error('📷 Error extracting EXIF data:', error);
    return null;
  }
}

export function parseDateTimeToDate(dateTimeStr: string): Date | null {
  try {
    // EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
    const [date, time] = dateTimeStr.split(' ');
    const [year, month, day] = date.split(':');
    const [hour, minute, second] = time.split(':');
    
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );
  } catch (error) {
    console.error('📷 Error parsing EXIF datetime:', error);
    return null;
  }
}