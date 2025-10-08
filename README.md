# 🌸 Shirayuki Anime Scraper API

A comprehensive anime scraping API that provides anime information, streaming links, and search functionality from various anime sources.

## 📋 Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Example Responses](#example-responses)
- [Error Handling](#error-handling)
- [Contributing](#contributing)
- [License](#license)

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

## ⚠️ Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description",
  "extraction_time_seconds": 0.123,
  "timestamp": "2025-10-08T16:54:26.438Z"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (missing required parameters)
- `404` - Not Found (invalid endpoint or anime not found)
- `500` - Internal Server Error (scraping failure)

## 🛠️ Technologies Used

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Axios** - HTTP client for web scraping
- **Cheerio** - Server-side HTML parsing
- **Playwright** - Browser automation for complex scraping

## 📝 Rate Limiting

Please be respectful when using this API:
- Avoid making too many concurrent requests
- Implement reasonable delays between requests
- Cache responses when possible

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This API is for educational and personal use only. Please respect the terms of service of the scraped websites and use responsibly.

## 🔗 Links

- [GitHub Repository](https://github.com/Anandadevnath/anime-mega-stream-api)
- [Issues](https://github.com/Anandadevnath/anime-mega-stream-api/issues)

---

Made with ❤️ by the Shirayuki team