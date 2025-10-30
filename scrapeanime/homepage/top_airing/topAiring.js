
import axios from 'axios';

export default async function scrapeTopAiring() {
  const response = await axios.get('https://kitsu.io/api/edge/anime', {
    params: {
      'sort': '-averageRating', 
      'page[limit]': 10
    },
    timeout: 5000
  });
  const data = response.data && response.data.data ? response.data.data : [];
  const items = data.map((anime) => {
    const attr = anime.attributes;
    const isTV = attr.subtype === 'tv';
    return {
      title: attr.titles && (attr.titles.en || attr.titles.en_jp || attr.canonicalTitle) || attr.canonicalTitle,
      image: attr.posterImage && attr.posterImage.original || null,
      episodes: attr.episodeCount || null,
      subtype: attr.subtype || null,
      status: attr.status || null,
      tv: isTV,
      source: 'kitsu',
      section: 'overrated'
    };
  });
  return items;
}
