// lib/customBannerGenerator.ts

interface BannerTheme {
  gradient: [string, string];
  pattern: 'medical' | 'modern' | 'professional' | 'minimal';
}

const THEMES: BannerTheme[] = [
  { gradient: ['#0ea5e9', '#0369a1'], pattern: 'medical' },      // Sky blue
  { gradient: ['#8b5cf6', '#6d28d9'], pattern: 'professional' }, // Purple
  { gradient: ['#06b6d4', '#0891b2'], pattern: 'modern' },       // Cyan
  { gradient: ['#10b981', '#059669'], pattern: 'medical' },      // Green
  { gradient: ['#f59e0b', '#d97706'], pattern: 'professional' }, // Amber
  { gradient: ['#ec4899', '#be185d'], pattern: 'modern' },       // Pink
  { gradient: ['#6366f1', '#4f46e5'], pattern: 'minimal' },      // Indigo
];

/**
 * Split text into two lines intelligently at word boundaries
 * Reduced maxCharsPerLine to prevent text overflow
 */
function splitTextIntoLines(text: string, maxCharsPerLine: number = 28): string[] {
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  // Try to split at a word boundary near the middle
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Single word is too long, force split
        lines.push(word.substring(0, maxCharsPerLine - 3) + '...');
        currentLine = '';
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Return maximum of 2 lines
  if (lines.length > 2) {
    // Combine remaining words into second line with ellipsis if too long
    const remainingWords = lines.slice(1).join(' ');
    if (remainingWords.length > maxCharsPerLine) {
      lines[1] = remainingWords.substring(0, maxCharsPerLine - 3) + '...';
    } else {
      lines[1] = remainingWords;
    }
    return [lines[0], lines[1]];
  }

  return lines;
}

/**
 * Generate a custom banner with clinic name, rating, and optional favicon
 */
export function generateCustomBanner(
  clinicName: string,
  rating?: number,
  faviconUrl?: string,
  placeId?: string
): string {
  // Select theme based on clinic name (deterministic)
  const themeIndex = placeId 
    ? placeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % THEMES.length
    : Math.floor(Math.random() * THEMES.length);
  
  const theme = THEMES[themeIndex];
  const [color1, color2] = theme.gradient;

  // Get pattern based on theme
  const pattern = getPattern(theme.pattern, color1);

  // Split name into lines if needed
  const nameLines = splitTextIntoLines(clinicName, 28);
  const isMultiLine = nameLines.length > 1;

  // Calculate positions with better spacing
  const iconY = -40;
  const firstLineY = isMultiLine ? 50 : 55;
  const secondLineY = 95;
  const ratingY = isMultiLine ? 130 : 100;

  // Adjust font size for better fit - reduced from 46/52 to 42/48
  const fontSize = isMultiLine ? 42 : 48;

  const svg = `
    <svg width="1600" height="400" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:0.95" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:0.95" />
        </linearGradient>
        ${pattern}
        
        <!-- Shadow filter for depth -->
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <!-- Background gradient -->
      <rect width="1600" height="400" fill="url(#grad)" />
      
      <!-- Pattern overlay -->
      <rect width="1600" height="400" fill="url(#pattern)" opacity="0.1" />
      
      <!-- Center content container -->
      <g transform="translate(800, 200)">
        ${faviconUrl ? `
          <!-- Favicon circle with shadow -->
          <circle cx="0" cy="${iconY - 2}" r="52" fill="rgba(0,0,0,0.1)" />
          <circle cx="0" cy="${iconY}" r="52" fill="rgba(255,255,255,0.2)" />
          <circle cx="0" cy="${iconY}" r="46" fill="white" filter="url(#shadow)" />
          
          <!-- Favicon placeholder (if loading fails) -->
          <text x="0" y="${iconY + 12}" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="40" fill="${color1}">
            🏥
          </text>
        ` : `
          <!-- Default medical icon with shadow -->
          <circle cx="0" cy="${iconY - 2}" r="52" fill="rgba(0,0,0,0.1)" />
          <circle cx="0" cy="${iconY}" r="52" fill="rgba(255,255,255,0.2)" />
          <circle cx="0" cy="${iconY}" r="46" fill="white" filter="url(#shadow)" />
          <text x="0" y="${iconY + 12}" text-anchor="middle" 
                font-family="Arial, sans-serif" font-size="40">
            🏥
          </text>
        `}
        
        <!-- Clinic name - centered (first line) -->
        <text x="0" y="${firstLineY}" 
              text-anchor="middle"
              font-family="Arial, Helvetica, sans-serif" 
              font-size="${fontSize}" 
              font-weight="bold" 
              fill="white"
              filter="url(#shadow)">
          ${escapeXml(nameLines[0])}
        </text>
        
        ${isMultiLine ? `
          <!-- Clinic name - second line -->
          <text x="0" y="${secondLineY}" 
                text-anchor="middle"
                font-family="Arial, Helvetica, sans-serif" 
                font-size="${fontSize}" 
                font-weight="bold" 
                fill="white"
                filter="url(#shadow)">
            ${escapeXml(nameLines[1])}
          </text>
        ` : ''}
        
        ${rating ? `
          <!-- Rating badge - centered -->
          <g transform="translate(0, ${ratingY})">
            <!-- Badge background with shadow -->
            <rect x="-65" y="-2" width="130" height="40" rx="20" 
                  fill="rgba(0,0,0,0.1)" />
            <rect x="-65" y="-4" width="130" height="40" rx="20" 
                  fill="white" opacity="0.95" filter="url(#shadow)" />
            
            <!-- Star icon -->
            <text x="-35" y="22" 
                  font-family="Arial, sans-serif" 
                  font-size="22" 
                  fill="#fbbf24">★</text>
            
            <!-- Rating number -->
            <text x="0" y="22" 
                  text-anchor="middle"
                  font-family="Arial, sans-serif" 
                  font-size="22" 
                  font-weight="600" 
                  fill="${color1}">
              ${rating.toFixed(1)}
            </text>
          </g>
        ` : ''}
      </g>
      
      <!-- Decorative accent lines -->
      <rect x="0" y="0" width="1600" height="4" fill="white" opacity="0.1" />
      <rect x="0" y="396" width="1600" height="4" fill="white" opacity="0.2" />
      
      <!-- Bottom gradient overlay -->
      <defs>
        <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:black;stop-opacity:0" />
          <stop offset="100%" style="stop-color:black;stop-opacity:0.2" />
        </linearGradient>
      </defs>
      <rect x="0" y="300" width="1600" height="100" fill="url(#bottomFade)" />
    </svg>
  `;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Generate pattern based on theme type
 */
function getPattern(patternType: string, color: string): string {
  switch (patternType) {
    case 'medical':
      // Plus signs pattern
      return `
        <pattern id="pattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 25 10 L 25 40 M 10 25 L 40 25" stroke="white" stroke-width="2" />
        </pattern>
      `;
    
    case 'modern':
      // Diagonal lines
      return `
        <pattern id="pattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 0 40 L 40 0" stroke="white" stroke-width="1" />
        </pattern>
      `;
    
    case 'professional':
      // Dots pattern
      return `
        <pattern id="pattern" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="15" cy="15" r="2" fill="white" />
        </pattern>
      `;
    
    case 'minimal':
    default:
      // No pattern
      return `<pattern id="pattern" x="0" y="0" width="1" height="1" patternUnits="userSpaceOnUse"></pattern>`;
  }
}

/**
 * Truncate text to max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get favicon URL from clinic website
 * Returns Google's favicon service as fallback
 */
export function getFaviconUrl(websiteUrl?: string): string | undefined {
  if (!websiteUrl) return undefined;

  try {
    const domain = new URL(websiteUrl).hostname;
    // Use Google's favicon service (free and reliable)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch (error) {
    return undefined;
  }
}

/**
 * Generate banner with async favicon loading
 * This version can be used in React components
 */
export async function generateBannerWithFavicon(
  clinicName: string,
  rating?: number,
  websiteUrl?: string,
  placeId?: string
): Promise<string> {
  const faviconUrl = getFaviconUrl(websiteUrl);
  
  // For now, just use the medical emoji
  // In a real implementation, you'd load the favicon and embed it
  return generateCustomBanner(clinicName, rating, faviconUrl, placeId);
}
