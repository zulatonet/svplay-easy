
import { IPTVItem } from '../types';

export const parseM3U = async (text: string): Promise<IPTVItem[]> => {
  const items: IPTVItem[] = [];
  const lines = text.split(/\r?\n/);
  
  let currentMetadata: any = null;
  const ATTR_REGEX = /([a-z-]+)="([^"]*)"/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const attrs: Record<string, string> = {};
      let match;
      while ((match = ATTR_REGEX.exec(line)) !== null) {
        attrs[match[1].toLowerCase()] = match[2];
      }

      const commaIndex = line.lastIndexOf(',');
      const displayName = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : 'Canal Sem Nome';

      currentMetadata = {
        name: attrs['tvg-name'] || displayName,
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || 'OUTROS',
        tvgId: attrs['tvg-id'] || '',
        type: 'live' as const
      };

      const groupLower = currentMetadata.group.toLowerCase();
      if (groupLower.includes('filme') || groupLower.includes('movie') || groupLower.includes('vod')) {
        currentMetadata.type = 'movie';
      } else if (groupLower.includes('serie')) {
        currentMetadata.type = 'series';
      }
    } else if (line.startsWith('http')) {
      if (currentMetadata) {
        const urlLower = line.toLowerCase();
        if (urlLower.includes('.mp4') || urlLower.includes('.mkv')) {
          currentMetadata.type = 'movie';
        }

        items.push({
          ...currentMetadata,
          url: line,
          id: `ch-${i}-${Math.random().toString(36).substr(2, 5)}`
        });
        currentMetadata = null;
      }
    }

    if (i % 2000 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return items;
};
