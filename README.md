# 🌸 Shirayuki Anime Scraper API

It is a anime scraping API that provides anime information, streaming links, and search functionality from HiAnime and 123animehub.

## 🎯 Goals of this Website

- **🤖 AI Agent for Animes** - Intelligent recommendation system that learns user preferences and suggests personalized anime content
- **📊 Ranking System** - Comprehensive ranking algorithms that analyze popularity, ratings, and user engagement to provide accurate anime rankings
- **📝 Auto Watchlist Save** - Seamless integration with MyAnimeList website for automatic watchlist synchronization and progress tracking

## ✨ Features

- 🏠 Homepage with trending anime
- 🔍 Search anime by title
- 📺 Get streaming links for episodes
- 🎭 Browse anime by genre
- 📝 A-Z anime listing
- 🏆 Top 10 anime rankings (daily, weekly, monthly)
- 💡 Search suggestions
- 📖 Detailed anime information
- ⚡ Fast and reliable scraping

## 🚀 Installation

1. Clone the repository:

```bash
git clone https://github.com/Anandadevnath/anime-mega-stream-api.git
cd shirayuki-backend
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

The API will be available at `http://localhost:5000`

## 🎯 Usage

The API provides RESTful endpoints for accessing anime data. All responses are in JSON format.

Base URL: `http://localhost:5000`

## 📍 API Endpoints

### 🏠 Homepage

- **GET** `/home`
- Get trending anime, latest releases, popular anime, and more

### 🔍 Search

- **GET** `/search?keyword={query}`
- Search for anime by title
- **Parameters:**
  - `keyword` (required): Search query

### 💡 Search Suggestions

- **GET** `/search/suggestions?q={query}`
- Get search suggestions for anime titles
- **Parameters:**
  - `q` (required): Query for suggestions

### 🎭 Browse by Genre

- **GET** `/genere/{genre}?page={page}`
- Get anime by specific genre
- **Parameters:**
  - `genre` (required): Genre name (e.g., Action, Comedy, Romance)
  - `page` (optional): Page number (default: 1)

### 📝 A-Z Anime Listing

- **GET** `/az-all-anime/{letter}?page={page}`
- Get anime starting with specific letter
- **Parameters:**
  - `letter` (required): Letter or "all" for all anime
  - `page` (optional): Page number (default: 1)

### 🏆 Top Rankings

- **GET** `/top10` - Daily top 10 anime
- **GET** `/weekly10` - Weekly top 10 anime
- **GET** `/monthly10` - Monthly top 10 anime

### 📺 Episode Streaming

- **GET** `/episode-stream?id={anime_id}&ep={episode_number}`
- Get streaming links for specific episode
- **Parameters:**
  - `id` (required): Anime ID/slug
  - `ep` (required): Episode number

### 📖 Anime Details

- **GET** `/anime/{slug}`
- Get detailed information about specific anime
- **Parameters:**
  - `slug` (required): Anime slug/identifier

## 📊 Example Responses

### Search Results

```http
GET /search?keyword=one%20piece
```

```json
{
  "success": true,
  "total_results": 28,
  "data": [
    {
      "title": "One Piece",
      "sub": true,
      "dub": false,
      "image": "https://123animehub.cc/imgs/poster/one-piece.jpg",
      "episodes": "1145"
    },
    {
      "title": "One Piece (Dub)",
      "sub": false,
      "dub": true,
      "image": "https://123animehub.cc/imgs/poster/one-piece-dub.jpg",
      "episodes": "1133"
    }
  ],
  "extraction_time_seconds": 1.224,
  "message": "Search results for \"one piece\"",
  "timestamp": "2025-10-08T16:54:26.438Z",
  "source_url": "https://123animehub.cc/search?keyword=one%20piece"
}
```

### Genre Listing

```http
GET /genere/Action?page=1
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "Attack on Titan",
      "image": "https://123animehub.cc/imgs/poster/attack-on-titan.jpg",
      "sub": true,
      "dub": true,
      "episodes": "87"
    },
    {
      "index": 2,
      "title": "Demon Slayer",
      "image": "https://123animehub.cc/imgs/poster/demon-slayer.jpg",
      "sub": true,
      "dub": true,
      "episodes": "44"
    }
  ],
  "extraction_time_seconds": 0.892,
  "message": "Anime list for genre 'Action' - Page 1",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### A-Z Anime Listing

```http
GET /az-all-anime/all?page=1
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "86 EIGHTY-SIX",
      "image": "https://123animehub.cc/imgs/poster/86-eighty-six.jpg",
      "sub": true,
      "dub": true,
      "episodes": "23"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_found": 36,
    "total_counts": 15420,
    "has_next_page": true,
    "has_previous_page": false,
    "next_page": 2,
    "previous_page": null
  },
  "extraction_time_seconds": 1.156,
  "message": "Anime list for letter 'all' - Page 1",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Top 10 Rankings

```http
GET /top10
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "Demon Slayer: Kimetsu no Yaiba",
      "image": "https://123animehub.cc/imgs/poster/demon-slayer.jpg",
      "anime_redirect_link": "/anime/demon-slayer",
      "episodes": "44",
      "audio_type": "SUB"
    }
  ],
  "extraction_time_seconds": 2.145,
  "message": "Top 10 anime rankings",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Episode Streaming

```http
GET /episode-stream?id=one-piece-dub&ep=1
```

```json
{
  "success": true,
  "data": {
    "episode": 1,
    "anime_title": "One Piece (Dub)",
    "streaming_links": [
      {
        "server": "mp4upload",
        "url": "https://mp4upload.com/embed-xyz123.html",
        "quality": "720p"
      },
      {
        "server": "streamtape",
        "url": "https://streamtape.com/e/xyz123",
        "quality": "480p"
      }
    ]
  },
  "extraction_time_seconds": 1.892,
  "message": "Streaming links for One Piece (Dub) - Episode 1",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Search Suggestions

```http
GET /search/suggestions?q=demon
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "Demon Slayer: Kimetsu no Yaiba",
      "image": "https://123animehub.cc/imgs/poster/demon-slayer.jpg",
      "episode": "44",
      "calendar_date": "2023",
      "status": "completed",
      "type": "sub"
    }
  ],
  "extraction_time_seconds": 0.756,
  "message": "Search suggestions for \"demon\"",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Homepage Data

```http
GET /home
```

```json
{
  "success": true,
  "data": {
    "trending": [
      {
        "title": "Jujutsu Kaisen",
        "image": "https://123animehub.cc/imgs/poster/jujutsu-kaisen.jpg",
        "episode": "24",
        "status": "completed"
      }
    ],
    "latest": [
      {
        "title": "Chainsaw Man",
        "image": "https://123animehub.cc/imgs/poster/chainsaw-man.jpg",
        "episode": "12",
        "status": "airing"
      }
    ],
    "popular": [
      {
        "title": "Attack on Titan",
        "image": "https://123animehub.cc/imgs/poster/attack-on-titan.jpg",
        "episode": "87",
        "status": "completed"
      }
    ]
  },
  "extraction_time_seconds": 2.341,
  "message": "Homepage data retrieved successfully",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Weekly Top 10 Rankings

```http
GET /weekly10
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "Frieren: Beyond Journey's End",
      "image": "https://123animehub.cc/imgs/poster/frieren.jpg",
      "anime_redirect_link": "/anime/frieren",
      "episodes": "28",
      "audio_type": "SUB"
    },
    {
      "index": 2,
      "title": "Demon Slayer: Kimetsu no Yaiba",
      "image": "https://123animehub.cc/imgs/poster/demon-slayer.jpg",
      "anime_redirect_link": "/anime/demon-slayer",
      "episodes": "44",
      "audio_type": "SUB"
    }
  ],
  "extraction_time_seconds": 1.892,
  "message": "Weekly top 10 anime rankings",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Monthly Top 10 Rankings

```http
GET /monthly10
```

```json
{
  "success": true,
  "data": [
    {
      "index": 1,
      "title": "One Piece",
      "image": "https://123animehub.cc/imgs/poster/one-piece.jpg",
      "anime_redirect_link": "/anime/one-piece",
      "episodes": "1145",
      "audio_type": "SUB"
    },
    {
      "index": 2,
      "title": "Attack on Titan",
      "image": "https://123animehub.cc/imgs/poster/attack-on-titan.jpg",
      "anime_redirect_link": "/anime/attack-on-titan",
      "episodes": "87",
      "audio_type": "SUB"
    }
  ],
  "extraction_time_seconds": 2.156,
  "message": "Monthly top 10 anime rankings",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Anime Details

```http
GET /anime/one-piece-dub
```

```json
{
  "success": true,
  "data": {
    "title": "One Piece (Dub)",
    "anime_id": "one-piece-dub",
    "image": "https://123animehub.cc/imgs/poster/one-piece-dub.jpg",
    "description": "Monkey D. Luffy refuses to let anyone or anything stand in the way of his quest to become the king of all pirates...",
    "status": "Ongoing",
    "release_date": "1999",
    "genres": ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Shounen"],
    "total_episodes": "1133",
    "rating": "9.0",
    "studio": "Toei Animation",
    "audio_type": "DUB",
    "episodes": [
      {
        "episode_number": "1",
        "episode_title": "I'm Luffy! The Man Who's Gonna Be King of the Pirates!",
        "episode_url": "/anime/one-piece-dub/episode/1"
      },
      {
        "episode_number": "2",
        "episode_title": "Enter the Great Swordsman! Pirate Hunter Roronoa Zoro!",
        "episode_url": "/anime/one-piece-dub/episode/2"
      }
    ]
  },
  "extraction_time_seconds": 3.245,
  "message": "Anime details for 'one-piece-dub'",
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

### Single Episode Streaming (Updated Format)

```http
GET /episode-stream?id=one-piece-dub&ep=1000
```

````json
{
  "success": true,
  "anime_id": "one-piece-dub",
  "episode": "1000",
  "data": {
    "title": "One Piece Dub",
    "episode_number": "1000",
    "streaming_link": "https://play.bunnycdn.to/embed-3/UWxwb05ERkJXU1pUV1pXMFVrNEFBQXIv...",
    "range_id": "997-1046",
    "all_ranges": ["1-46", "47-96", "97-146", "147-196", "197-246", "247-296", "297-346", "347-396", "397-446", "447-496", "497-546", "547-596", "597-646", "647-696", "697-746", "747-796", "797-846", "847-896", "897-946", "947-996", "997-1046"]
  },
  "extraction_time_seconds": 5.408
}

## ⚠️ Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description",
  "extraction_time_seconds": 0.123,
  "timestamp": "2025-10-08T16:54:26.438Z"
}
````

## 🛠️ Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Axios** - HTTP client for web scraping
- **Cheerio** - Server-side HTML parsing
- **Puppeteer** - Browser automation for complex scraping

## � Deployment

You can deploy it on any cloud service that supports Puppeteer

### ☁️ Cloud Platforms with Puppeteer Support

1. **Railway** ⭐ (Recommended)
   - Built-in Puppeteer support
   - Easy deployment with Git integration
   - Automatic SSL certificates
   - Generous free tier

2. **Render**
   - Native Puppeteer support
   - Free tier available
   - Automatic builds from GitHub
   - Built-in environment variables

3. **Heroku**
   - Requires buildpack for Puppeteer
   - Add `heroku/nodejs` and `jontewks/puppeteer` buildpacks
   - Free tier discontinued, but hobby tier available


### 📦 Deployment Configuration

For most platforms, add these environment variables:
```bash
NODE_ENV=production
PORT=5000
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage
```

### 🐳 Docker Deployment

The included `Dockerfile` is optimized for cloud deployment:
```bash
docker build -t shirayuki-api .
docker run -p 5000:5000 shirayuki-api
```

## �📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This API is for educational and personal use only. Please respect the terms of service of the scraped websites and use responsibly.

## 🔗 Links

- [GitHub Repository](https://github.com/Anandadevnath/Shirayuki-Scrapper-API)
- [Issues](https://github.com/Anandadevnath/Shirayuki-Scrapper-API/issues)

---

Made with ❤️ by the Shirayuki team
