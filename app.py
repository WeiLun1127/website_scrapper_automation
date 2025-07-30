from flask import Flask, request, jsonify, render_template
import requests
from bs4 import BeautifulSoup
import json
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import pickle
import os

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.get_json()
    url = data.get('url')
    crawl_depth = data.get('crawl_depth', 0)  # Default to 0 (no subpage crawling)
    page = data.get('page', 0)  # Default to first page
    
    try:
        # Convert crawl_depth to int
        crawl_depth = int(crawl_depth)
        page = int(page)
    except (ValueError, TypeError):
        crawl_depth = 0
        page = 0
    
    # Limit crawl depth to 0 or 1 only
    if crawl_depth > 1:
        crawl_depth = 1
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    try:
        # Add http:// prefix if not present
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
        
        # Scrape main page
        main_result = scrape_url(url)
        
        # Add subpages data if crawl_depth > 0 (automatically crawls up to 20 subpages)
        if crawl_depth > 0 and main_result.get('links'):
            # Get all potential subpage URLs
            all_subpage_urls = get_all_subpage_urls(url, main_result['links'])
            
            # Save all URLs to session file for pagination
            save_crawl_session(url, all_subpage_urls)
            
            # Get current page of subpages
            main_result['subpages'] = crawl_subpages(url, all_subpage_urls, crawl_depth, page)
            
            # Add pagination info
            total_pages = (len(all_subpage_urls) + 19) // 20  # Ceiling division
            main_result['pagination'] = {
                'current_page': page,
                'total_pages': total_pages,
                'total_subpages': len(all_subpage_urls),
                'has_next': page < total_pages - 1
            }
        else:
            main_result['subpages'] = []
            main_result['pagination'] = {
                'current_page': 0,
                'total_pages': 0,
                'total_subpages': 0,
                'has_next': False
            }
            
        return jsonify(main_result)
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Error fetching URL: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'Error scraping content: {str(e)}'}), 500

@app.route('/continue_scraping', methods=['POST'])
def continue_scraping():
    """Continue scraping the next batch of subpages"""
    data = request.get_json()
    url = data.get('url')
    page = data.get('page', 1)  # Default to page 1 (second batch)
    
    try:
        page = int(page)
    except (ValueError, TypeError):
        page = 1
        
    if not url:
        return jsonify({'error': 'URL is required'}), 400
        
    try:
        # Load saved URLs from session
        all_subpage_urls = load_crawl_session(url)
        
        if not all_subpage_urls:
            return jsonify({'error': 'No saved crawl session found for this URL'}), 400
            
        # Get current page of subpages
        subpages = crawl_subpages(url, all_subpage_urls, 1, page)
        
        # Add pagination info
        total_pages = (len(all_subpage_urls) + 19) // 20  # Ceiling division
        
        result = {
            'subpages': subpages,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_subpages': len(all_subpage_urls),
                'has_next': page < total_pages - 1
            }
        }
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Error continuing scrape: {str(e)}'}), 500

def scrape_url(url):
    """Scrape a single URL and return the data"""
    response = requests.get(url, headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }, timeout=10)
    response.raise_for_status()
    
    # Use html5lib instead of lxml
    soup = BeautifulSoup(response.text, 'html5lib')
    
    # Extract basic page information
    result = {
        'url': url,
        'title': soup.title.text if soup.title else 'No title found',
        'meta_description': '',
        'h1_tags': [h1.text.strip() for h1 in soup.find_all('h1')],
        'links': [],
        'images': [],
        'full_text': extract_full_text(soup),  # Add full text content
        'all_content': []  # Add all content elements with their text
    }
    
    # Get meta description
    meta_desc = soup.find('meta', attrs={'name': 'description'})
    if meta_desc:
        result['meta_description'] = meta_desc.get('content', '')
    
    # Get links
    for link in soup.find_all('a', href=True)[:30]:  # Increased limit for subpage crawling
        href = link['href']
        # Convert relative URLs to absolute
        if href.startswith('/'):
            base_url = re.match(r'(https?://[^/]+)', url)
            if base_url:
                href = base_url.group(1) + href
        elif not href.startswith(('http://', 'https://')):
            # Handle relative URLs without leading slash
            base_url = url.rstrip('/')
            href = f"{base_url}/{href.lstrip('/')}"
        
        # Skip fragment links, javascript, mailto, etc.
        if href.startswith(('javascript:', 'mailto:', 'tel:')) or href == '#':
            continue
            
        # Skip external links
        if is_same_domain(url, href):
            result['links'].append({
                'text': link.text.strip(),
                'href': href
            })
    
    # Get images
    for img in soup.find_all('img', src=True)[:10]:  # Limit to first 10 images
        src = img['src']
        # Convert relative URLs to absolute
        if src.startswith('/'):
            base_url = re.match(r'(https?://[^/]+)', url)
            if base_url:
                src = base_url.group(1) + src
        elif not src.startswith(('http://', 'https://')):
            # Handle relative URLs without leading slash
            base_url = url.rstrip('/')
            src = f"{base_url}/{src.lstrip('/')}"
        
        result['images'].append({
            'src': src,
            'alt': img.get('alt', 'No alt text')
        })
        
    # Extract all content elements with their text
    result['all_content'] = extract_all_content(soup)
    
    return result

def get_all_subpage_urls(base_url, links):
    """Get all potential subpage URLs from the same domain"""
    subpage_urls = []
    visited_urls = set()
    
    for link in links:
        href = link['href']
        if href and is_same_domain(base_url, href) and href not in visited_urls:
            subpage_urls.append(href)
            visited_urls.add(href)
            
    return subpage_urls

def save_crawl_session(url, subpage_urls):
    """Save crawl session data to file for pagination"""
    domain = urllib.parse.urlparse(url).netloc.replace('www.', '')
    
    # Load existing crawl history
    crawl_history = {}
    if os.path.exists('crawl_history.pkl'):
        try:
            with open('crawl_history.pkl', 'rb') as f:
                crawl_history = pickle.load(f)
        except:
            crawl_history = {}
    
    # Update with new data
    crawl_history[domain] = {
        'url': url,
        'subpage_urls': subpage_urls,
        'timestamp': time.time()
    }
    
    # Save updated history
    with open('crawl_history.pkl', 'wb') as f:
        pickle.dump(crawl_history, f)

def load_crawl_session(url):
    """Load crawl session data from file"""
    domain = urllib.parse.urlparse(url).netloc.replace('www.', '')
    
    if not os.path.exists('crawl_history.pkl'):
        return []
        
    try:
        with open('crawl_history.pkl', 'rb') as f:
            crawl_history = pickle.load(f)
            
        if domain in crawl_history:
            return crawl_history[domain]['subpage_urls']
    except:
        pass
        
    return []

def crawl_subpages(base_url, subpage_urls, depth, page=0):
    """Crawl a specific page of subpages"""
    if depth <= 0 or not subpage_urls:
        return []
    
    # Calculate slice for current page
    start_idx = page * 20
    end_idx = start_idx + 20
    
    # Get URLs for current page
    current_page_urls = subpage_urls[start_idx:end_idx]
    
    if not current_page_urls:
        return []
    
    results = []
    
    # Use ThreadPoolExecutor for parallel crawling
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_to_url = {executor.submit(scrape_subpage, url, depth): url for url in current_page_urls}
        
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                data = future.result()
                if data:
                    results.append(data)
            except Exception as e:
                print(f"Error crawling {url}: {str(e)}")
    
    return results

def scrape_subpage(url, depth):
    """Scrape a subpage"""
    try:
        # Add a small delay to avoid overloading the server
        time.sleep(0.5)
        
        # Scrape the current page
        result = scrape_url(url)
        
        # No recursive crawling needed anymore
        result['subpages'] = []
            
        return result
    except Exception as e:
        print(f"Error scraping subpage {url}: {str(e)}")
        return None

def is_same_domain(url1, url2):
    """Check if two URLs belong to the same domain"""
    try:
        domain1 = urllib.parse.urlparse(url1).netloc
        domain2 = urllib.parse.urlparse(url2).netloc
        
        # Remove 'www.' prefix for comparison
        domain1 = domain1.replace('www.', '')
        domain2 = domain2.replace('www.', '')
        
        return domain1 == domain2
    except:
        return False

def extract_full_text(soup):
    """Extract all text from the page and clean it with better formatting"""
    # Create a copy of the soup to modify
    soup_copy = BeautifulSoup(str(soup), 'html5lib')
    
    # Remove unwanted elements that typically contain non-content or navigation
    for element in soup_copy.select('script, style, noscript, iframe, head, meta, link, footer, nav, header, aside, .menu, .navigation, .footer, .header, .sidebar, .nav, .social-media, .cookie-notice, .ad, .advertisement, .popup'):
        element.extract()
    
    # Remove elements with very short text (likely navigation items)
    for element in soup_copy.find_all(['li', 'span', 'a']):
        if len(element.get_text(strip=True)) < 3:
            element.extract()
    
    # Add line breaks and spacing for better readability
    for tag in soup_copy.find_all(['p', 'div', 'li', 'tr']):
        # Insert a newline before the tag
        tag.insert_before(soup_copy.new_string('\n'))
    
    # Add double line breaks and formatting for headings
    for i in range(1, 7):
        for heading in soup_copy.find_all(f'h{i}'):
            # Clear the space before the heading
            heading.insert_before(soup_copy.new_string('\n\n'))
            # Make headings stand out
            if heading.string:
                heading.string.replace_with(heading.get_text(strip=True).upper())
            # Add space after the heading
            heading.insert_after(soup_copy.new_string('\n'))
    
    # Replace <br> tags with newlines
    for br in soup_copy.find_all('br'):
        br.replace_with('\n')
    
    # Get text with better spacing
    text = soup_copy.get_text(separator=' ')
    
    # Clean the text
    # 1. Replace multiple spaces with a single space
    text = re.sub(r' +', ' ', text)
    # 2. Replace multiple newlines with at most two newlines
    text = re.sub(r'\n{3,}', '\n\n', text)
    # 3. Remove lines that are just whitespace or very short (likely menu items)
    lines = []
    for line in text.splitlines():
        line = line.strip()
        if line and len(line) > 1 and not re.match(r'^[©•\-–—|/\\:;,.]+$', line):
            lines.append(line)
    
    # 4. Join non-empty lines with newlines, adding extra spacing for readability
    formatted_text = ''
    prev_line_short = False
    
    for i, line in enumerate(lines):
        # Check if current line is a heading (all caps and not too long)
        is_heading = line.isupper() or (len(line) < 60 and line[0].isupper() and line[-1] not in '.,:;')
        
        # Add extra spacing before headings
        if is_heading and i > 0:
            formatted_text += '\n\n'
        # Add normal spacing between paragraphs
        elif i > 0 and not prev_line_short:
            formatted_text += '\n\n'
        # Add single line break after short lines
        elif i > 0:
            formatted_text += '\n'
            
        formatted_text += line
        prev_line_short = len(line) < 40
    
    # Final cleanup
    # Remove any remaining excessive whitespace
    formatted_text = re.sub(r'\n{3,}', '\n\n', formatted_text)
    # Remove common footer and copyright patterns
    formatted_text = re.sub(r'©\s*\d{4}.*?(rights reserved|all rights).*?$', '', formatted_text, flags=re.IGNORECASE|re.MULTILINE)
    
    return formatted_text

def extract_all_content(soup):
    """Extract all content elements with their tag name and text with better formatting"""
    content_elements = []
    
    # Define the elements we want to extract, focusing on main content elements
    elements_to_extract = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'section', 'main']
    
    # Extract elements with their text
    for tag_name in elements_to_extract:
        for element in soup.find_all(tag_name):
            # Skip elements that are likely navigation, footer, etc.
            if any(cls in str(element.get('class', [])).lower() for cls in ['menu', 'nav', 'footer', 'header', 'sidebar']):
                continue
                
            # Skip empty elements or those with very little text
            element_text = get_formatted_element_text(element)
            if element_text and len(element_text) > 10:  # Increased minimum length
                # Try to get an id or class for identification
                element_id = element.get('id', '')
                element_class = ' '.join(element.get('class', []))
                
                content_elements.append({
                    'tag': tag_name,
                    'id': element_id,
                    'class': element_class,
                    'text': element_text
                })
    
    return content_elements

def get_formatted_element_text(element):
    """Extract text from an element with better formatting"""
    # Create a copy of the element to modify
    element_copy = BeautifulSoup(str(element), 'html5lib')
    
    # Remove unwanted nested elements
    for unwanted in element_copy.select('script, style, nav, .menu, .navigation'):
        unwanted.extract()
    
    # Replace <br> tags with newlines
    for br in element_copy.find_all('br'):
        br.replace_with('\n')
    
    # Get text with proper spacing
    text = element_copy.get_text(separator=' ')
    
    # Clean the text
    # 1. Replace multiple spaces with a single space
    text = re.sub(r' +', ' ', text)
    # 2. Replace multiple newlines with a single newline
    text = re.sub(r'\n{2,}', '\n', text)
    # 3. Trim whitespace from each line
    lines = [line.strip() for line in text.splitlines()]
    # 4. Join non-empty lines with newlines
    text = '\n'.join(line for line in lines if line and len(line) > 1)
    # 5. Trim the final text
    text = text.strip()
    
    return text

if __name__ == '__main__':
    app.run(debug=True)
    
# This is for Vercel deployment
app.debug = False 