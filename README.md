# Web Scraper Tool

A simple web scraping tool built with Python (Flask) and a responsive HTML/CSS/JS frontend. This tool allows you to extract data from websites by providing a URL.

## Features

- Extract basic information from websites (title, meta description)
- Collect headings (H1 tags)
- Extract links with their text and URLs
- Find images with their source URLs and alt text
- Extract sample paragraphs of content
- Responsive design that works on mobile and desktop
- Accessible UI with proper semantic HTML and ARIA attributes

## Installation

1. Clone this repository
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

## Usage

### Local Development

1. Start the Flask application:

```bash
python app.py
```

2. Open your browser and navigate to `http://localhost:5000`
3. Enter a website URL in the input field and click "Scrape Website"
4. View the extracted data in the results section

### Deployment on Vercel

This application is configured to be deployed on Vercel:

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel
3. Vercel will automatically detect the Python application
4. No additional configuration is needed as the `vercel.json` file handles the setup

## Dependencies

- Python 3.6+
- Flask - Web framework
- BeautifulSoup4 - HTML parsing library
- Requests - HTTP library
- lxml - HTML parser

## Notes

- This tool is for educational purposes only
- Be respectful of websites' robots.txt and terms of service
- Avoid scraping websites at high frequency
- Some websites may block scraping attempts

## Future Improvements

- Add support for more detailed scraping options
- Implement data export (CSV, JSON)
- Add authentication for API access
- Improve error handling and validation
- Add support for scraping JavaScript-rendered content

## License

MIT 