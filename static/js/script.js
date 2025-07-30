// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    const scraperForm = document.getElementById('scraper-form');
    const urlInput = document.getElementById('url-input');
    const crawlDepthSelect = document.getElementById('crawl-depth');
    const clearButton = document.getElementById('clear-button');
    const loadingElement = document.getElementById('loading');
    const errorMessageElement = document.getElementById('error-message');
    const resultsElement = document.getElementById('results');
    
    // Elements for displaying results
    const pageTitleElement = document.getElementById('page-title');
    const metaDescriptionElement = document.getElementById('meta-description');
    const headingsListElement = document.getElementById('headings-list');
    const linksListElement = document.getElementById('links-list');
    const linksContainer = document.getElementById('links-container');
    const imagesListElement = document.getElementById('images-list');
    const imagesContainer = document.getElementById('images-container');
    
    // New elements for full text and all content
    const toggleFullTextButton = document.getElementById('toggle-full-text');
    const copyFullTextButton = document.getElementById('copy-full-text');
    const fullTextContainer = document.getElementById('full-text-container');
    const fullTextContent = document.getElementById('full-text-content');
    
    const toggleAllContentButton = document.getElementById('toggle-all-content');
    const contentFilterInput = document.getElementById('content-filter');
    const allContentContainer = document.getElementById('all-content-container');
    const allContentList = document.getElementById('all-content-list');
    
    // Subpages elements
    const subpagesSection = document.getElementById('subpages-section');
    const subpagesContainer = document.getElementById('subpages-container');
    const subpagesList = document.getElementById('subpages-list');
    
    // Store all content items for filtering
    let allContentItems = [];
    
    // Store current URL and pagination info
    let currentUrl = '';
    let currentPagination = null;
    
    // Set up collapsible sections
    setupCollapsibleSections();
    
    // Add form submit event listener
    scraperForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get URL from input
        const url = urlInput.value.trim();
        const crawlDepth = crawlDepthSelect.value;
        
        // Store current URL
        currentUrl = url;
        
        // Validate URL
        if (!url) {
            showError('Please enter a valid URL');
            return;
        }
        
        // Clear previous results
        clearResults();
        
        // Show loading indicator
        loadingElement.classList.remove('hidden');
        
        // Update loading message - we're always including subpages now
        const loadingMessage = loadingElement.querySelector('p');
        loadingMessage.textContent = 'Scraping in progress (including up to 20 subpages)...';
        
        try {
            // Send request to backend
            const response = await fetch('/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url,
                    crawl_depth: crawlDepth,
                    page: 0 // Start with first page
                }),
            });
            
            // Hide loading indicator
            loadingElement.classList.add('hidden');
            
            // Check if response is ok
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to scrape website');
            }
            
            // Parse response data
            const data = await response.json();
            
            // Store pagination info
            currentPagination = data.pagination;
            
            // Display results
            displayResults(data);
            
        } catch (error) {
            // Hide loading indicator
            loadingElement.classList.add('hidden');
            
            // Show error message
            showError(error.message || 'An error occurred while scraping the website');
        }
    });
    
    // Function to load more subpages
    async function loadMoreSubpages(page) {
        if (!currentUrl) {
            return;
        }
        
        // Show loading indicator
        loadingElement.classList.remove('hidden');
        loadingElement.querySelector('p').textContent = `Loading more subpages (page ${page + 1})...`;
        
        try {
            // Send request to backend
            const response = await fetch('/continue_scraping', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url: currentUrl,
                    page: page
                }),
            });
            
            // Hide loading indicator
            loadingElement.classList.add('hidden');
            
            // Check if response is ok
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load more subpages');
            }
            
            // Parse response data
            const data = await response.json();
            
            // Update pagination info
            currentPagination = data.pagination;
            
            // Append new subpages
            if (data.subpages && data.subpages.length > 0) {
                // Update subpages heading to show count
                const subpagesHeading = subpagesSection.querySelector('h3');
                const totalSubpages = currentPagination.total_subpages;
                const loadedSubpages = Math.min((currentPagination.current_page + 1) * 20, totalSubpages);
                subpagesHeading.textContent = `Subpages (${loadedSubpages} of ${totalSubpages})`;
                
                // Display subpages
                displaySubpages(data.subpages, true); // true = append mode
                
                // Update pagination controls
                updatePaginationControls();
            }
            
        } catch (error) {
            // Hide loading indicator
            loadingElement.classList.add('hidden');
            
            // Show error message
            showError(error.message || 'An error occurred while loading more subpages');
        }
    }
    
    // Function to create pagination controls
    function createPaginationControls() {
        // Remove existing pagination controls if any
        const existingControls = document.getElementById('pagination-controls');
        if (existingControls) {
            existingControls.remove();
        }
        
        // Create pagination controls container
        const paginationControls = document.createElement('div');
        paginationControls.id = 'pagination-controls';
        paginationControls.classList.add('pagination-controls');
        
        // Create load more button if there are more pages
        if (currentPagination && currentPagination.has_next) {
            const loadMoreButton = document.createElement('button');
            loadMoreButton.type = 'button';
            loadMoreButton.classList.add('action-button');
            loadMoreButton.textContent = `Load More Subpages`;
            
            // Add event listener
            loadMoreButton.addEventListener('click', () => {
                loadMoreSubpages(currentPagination.current_page + 1);
            });
            
            // Add pagination info
            const paginationInfo = document.createElement('p');
            const currentPage = currentPagination.current_page + 1; // 0-indexed to 1-indexed
            const totalPages = currentPagination.total_pages;
            const loadedSubpages = Math.min(currentPage * 20, currentPagination.total_subpages);
            const totalSubpages = currentPagination.total_subpages;
            
            paginationInfo.textContent = `Showing ${loadedSubpages} of ${totalSubpages} subpages (Page ${currentPage}/${totalPages})`;
            paginationInfo.classList.add('pagination-info');
            
            paginationControls.appendChild(paginationInfo);
            paginationControls.appendChild(loadMoreButton);
        }
        
        return paginationControls;
    }
    
    // Function to update pagination controls
    function updatePaginationControls() {
        // Create new pagination controls
        const paginationControls = createPaginationControls();
        
        // Add to subpages section if there are controls
        if (paginationControls.children.length > 0) {
            // Remove existing controls
            const existingControls = document.getElementById('pagination-controls');
            if (existingControls) {
                existingControls.remove();
            }
            
            // Add new controls
            subpagesContainer.appendChild(paginationControls);
        }
    }

    // Function to set up collapsible sections
    function setupCollapsibleSections() {
        const toggleButtons = document.querySelectorAll('.toggle-section');
        
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                const expanded = button.getAttribute('aria-expanded') === 'true';
                const targetId = button.getAttribute('aria-controls');
                const targetElement = document.getElementById(targetId);
                const expandIcon = button.querySelector('.expand-icon');
                const collapseIcon = button.querySelector('.collapse-icon');
                
                if (expanded) {
                    // Collapse the section
                    targetElement.classList.add('hidden');
                    button.setAttribute('aria-expanded', 'false');
                    expandIcon.classList.remove('hidden');
                    collapseIcon.classList.add('hidden');
                } else {
                    // Expand the section
                    targetElement.classList.remove('hidden');
                    button.setAttribute('aria-expanded', 'true');
                    expandIcon.classList.add('hidden');
                    collapseIcon.classList.remove('hidden');
                }
            });
        });
    }
    
    // Add clear button event listener
    clearButton.addEventListener('click', () => {
        urlInput.value = '';
        clearResults();
        
        // Reset current URL and pagination
        currentUrl = '';
        currentPagination = null;
    });
    
    // Add toggle full text button event listener
    toggleFullTextButton.addEventListener('click', () => {
        const isHidden = fullTextContainer.classList.contains('hidden');
        
        if (isHidden) {
            fullTextContainer.classList.remove('hidden');
            toggleFullTextButton.textContent = 'Hide Full Text';
        } else {
            fullTextContainer.classList.add('hidden');
            toggleFullTextButton.textContent = 'Show Full Text';
        }
    });
    
    // Add copy full text button event listener
    copyFullTextButton.addEventListener('click', () => {
        const text = fullTextContent.textContent;
        
        if (text) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    const originalText = copyFullTextButton.textContent;
                    copyFullTextButton.textContent = 'Copied!';
                    
                    setTimeout(() => {
                        copyFullTextButton.textContent = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                });
        }
    });
    
    // Add toggle all content button event listener
    toggleAllContentButton.addEventListener('click', () => {
        const isHidden = allContentContainer.classList.contains('hidden');
        
        if (isHidden) {
            allContentContainer.classList.remove('hidden');
            toggleAllContentButton.textContent = 'Hide All Content';
        } else {
            allContentContainer.classList.add('hidden');
            toggleAllContentButton.textContent = 'Show All Content';
        }
    });
    
    // Add content filter input event listener
    contentFilterInput.addEventListener('input', (e) => {
        const filterText = e.target.value.toLowerCase();
        
        filterContentItems(filterText);
    });
    
    // Function to filter content items
    function filterContentItems(filterText) {
        // Get all content items
        const contentItems = document.querySelectorAll('.content-item');
        
        // Filter items
        contentItems.forEach(item => {
            const text = item.querySelector('.content-item-text').textContent.toLowerCase();
            const tag = item.querySelector('.content-item-tag').textContent.toLowerCase();
            
            if (text.includes(filterText) || tag.includes(filterText)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    // Function to display error message
    function showError(message) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
    }
    
    // Function to clear results
    function clearResults() {
        // Hide results and error message
        resultsElement.classList.add('hidden');
        errorMessageElement.classList.add('hidden');
        
        // Clear result elements
        pageTitleElement.textContent = '';
        metaDescriptionElement.textContent = '';
        headingsListElement.innerHTML = '';
        linksListElement.innerHTML = '';
        imagesListElement.innerHTML = '';
        fullTextContent.textContent = '';
        allContentList.innerHTML = '';
        subpagesList.innerHTML = '';
        
        // Hide subpages section
        subpagesSection.classList.add('hidden');
        
        // Reset toggle buttons
        allContentContainer.classList.add('hidden');
        toggleAllContentButton.textContent = 'Show All Content';
        
        // Reset collapsible sections
        const toggleButtons = document.querySelectorAll('.toggle-section');
        toggleButtons.forEach(button => {
            button.setAttribute('aria-expanded', 'false');
            button.querySelector('.expand-icon').classList.remove('hidden');
            button.querySelector('.collapse-icon').classList.add('hidden');
        });
        
        // Hide section content
        linksContainer.classList.add('hidden');
        imagesContainer.classList.add('hidden');
        
        // Clear filter input
        contentFilterInput.value = '';
        
        // Also clear any pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            paginationControls.remove();
        }
    }
    
    // Function to display results
    function displayResults(data) {
        // Show results container
        resultsElement.classList.remove('hidden');
        
        // Display basic information
        pageTitleElement.textContent = data.title || 'No title found';
        metaDescriptionElement.textContent = data.meta_description || 'No meta description found';
        
        // Display headings
        if (data.h1_tags && data.h1_tags.length > 0) {
            data.h1_tags.forEach(heading => {
                const li = document.createElement('li');
                li.textContent = heading;
                headingsListElement.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No headings found';
            headingsListElement.appendChild(li);
        }
        
        // Display links
        if (data.links && data.links.length > 0) {
            data.links.forEach(link => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = link.href;
                a.textContent = link.text || link.href;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                li.appendChild(a);
                linksListElement.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No links found';
            linksListElement.appendChild(li);
        }
        
        // Display images
        if (data.images && data.images.length > 0) {
            data.images.forEach(image => {
                const li = document.createElement('li');
                li.classList.add('image-item');
                
                const imgInfo = document.createElement('div');
                imgInfo.classList.add('image-info');
                
                const altText = document.createElement('p');
                altText.innerHTML = `<strong>Alt text:</strong> ${image.alt || 'No alt text'}`;
                
                const srcText = document.createElement('p');
                srcText.innerHTML = `<strong>Source:</strong> <span class="image-src">${image.src}</span>`;
                
                imgInfo.appendChild(altText);
                imgInfo.appendChild(srcText);
                li.appendChild(imgInfo);
                
                imagesListElement.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No images found';
            imagesListElement.appendChild(li);
        }
        
        // Display full text content
        if (data.full_text) {
            // Format the text for better readability if needed
            fullTextContent.textContent = data.full_text;
        } else {
            fullTextContent.textContent = 'No text content found';
        }
        
        // Display all content elements
        if (data.all_content && data.all_content.length > 0) {
            // Store all content items for filtering
            allContentItems = data.all_content;
            
            // Display content items
            displayContentItems(allContentItems);
        } else {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No content elements found';
            allContentList.appendChild(emptyMessage);
        }
        
        // Display subpages if available
        if (data.subpages && data.subpages.length > 0) {
            // Show subpages section
            subpagesSection.classList.remove('hidden');
            
            // Update subpages heading to show count
            const subpagesHeading = subpagesSection.querySelector('h3');
            if (data.pagination) {
                const totalSubpages = data.pagination.total_subpages;
                const loadedSubpages = Math.min((data.pagination.current_page + 1) * 20, totalSubpages);
                subpagesHeading.textContent = `Subpages (${loadedSubpages} of ${totalSubpages})`;
            } else {
                subpagesHeading.textContent = `Subpages (${data.subpages.length})`;
            }
            
            // Display subpages
            displaySubpages(data.subpages);
            
            // Add pagination controls if needed
            if (data.pagination && data.pagination.has_next) {
                const paginationControls = createPaginationControls();
                subpagesContainer.appendChild(paginationControls);
            }
        }
    }
    
    // Function to display content items
    function displayContentItems(items) {
        // Clear previous items
        allContentList.innerHTML = '';
        
        // Display items
        items.forEach(item => {
            const contentItem = document.createElement('div');
            contentItem.classList.add('content-item');
            
            const header = document.createElement('div');
            header.classList.add('content-item-header');
            
            const tag = document.createElement('span');
            tag.classList.add('content-item-tag');
            tag.textContent = item.tag;
            
            const identifiers = document.createElement('span');
            identifiers.classList.add('content-item-identifiers');
            
            // Add id and class if available
            const idText = item.id ? `id="${item.id}"` : '';
            const classText = item.class ? `class="${item.class}"` : '';
            
            if (idText || classText) {
                identifiers.textContent = `${idText} ${classText}`.trim();
            }
            
            header.appendChild(tag);
            header.appendChild(identifiers);
            
            const text = document.createElement('div');
            text.classList.add('content-item-text');
            text.textContent = item.text;
            
            contentItem.appendChild(header);
            contentItem.appendChild(text);
            
            allContentList.appendChild(contentItem);
        });
    }
    
    // Function to display subpages
    function displaySubpages(subpages, append = false) {
        // Clear previous items if not appending
        if (!append) {
            subpagesList.innerHTML = '';
        }
        
        // Display subpages
        subpages.forEach(subpage => {
            if (!subpage) return; // Skip null/undefined subpages
            
            const subpageItem = document.createElement('div');
            subpageItem.classList.add('subpage-item');
            
            // Create subpage header
            const header = document.createElement('div');
            header.classList.add('subpage-header');
            
            const title = document.createElement('h4');
            title.classList.add('subpage-title');
            title.textContent = subpage.title || 'Untitled Page';
            
            const url = document.createElement('div');
            url.classList.add('subpage-url');
            
            const urlLink = document.createElement('a');
            urlLink.href = subpage.url;
            urlLink.textContent = subpage.url;
            urlLink.target = '_blank';
            urlLink.rel = 'noopener noreferrer';
            
            url.appendChild(urlLink);
            header.appendChild(title);
            header.appendChild(url);
            
            // Create subpage content
            const content = document.createElement('div');
            content.classList.add('subpage-content');
            
            // Add full text content directly
            if (subpage.full_text) {
                const textSection = document.createElement('div');
                textSection.classList.add('subpage-section');
                
                const textTitle = document.createElement('h4');
                textTitle.textContent = 'Text Content';
                
                // Add button controls
                const buttonControls = document.createElement('div');
                buttonControls.classList.add('button-controls');
                
                // Add copy full text button
                const copyFullButton = document.createElement('button');
                copyFullButton.type = 'button';
                copyFullButton.classList.add('action-button', 'small');
                copyFullButton.textContent = 'Copy Text';
                copyFullButton.addEventListener('click', () => {
                    copyTextToClipboard(subpage.full_text, copyFullButton);
                });
                
                // Add toggle button to hide/show text
                const toggleButton = document.createElement('button');
                toggleButton.type = 'button';
                toggleButton.classList.add('toggle-button', 'small');
                toggleButton.textContent = 'Hide Content';
                
                const fullTextDiv = document.createElement('div');
                fullTextDiv.classList.add('subpage-full-text');
                fullTextDiv.textContent = subpage.full_text;
                
                toggleButton.addEventListener('click', () => {
                    const isHidden = fullTextDiv.classList.contains('hidden');
                    if (isHidden) {
                        fullTextDiv.classList.remove('hidden');
                        toggleButton.textContent = 'Hide Content';
                    } else {
                        fullTextDiv.classList.add('hidden');
                        toggleButton.textContent = 'Show Content';
                    }
                });
                
                buttonControls.appendChild(copyFullButton);
                buttonControls.appendChild(toggleButton);
                
                textSection.appendChild(textTitle);
                textSection.appendChild(buttonControls);
                textSection.appendChild(fullTextDiv);
                content.appendChild(textSection);
            }
            
            // Add headings if available
            if (subpage.h1_tags && subpage.h1_tags.length > 0) {
                const headingsSection = document.createElement('div');
                headingsSection.classList.add('subpage-section');
                
                const headingsTitle = document.createElement('h4');
                headingsTitle.textContent = 'Headings';
                
                const headingsList = document.createElement('ul');
                headingsList.classList.add('subpage-list');
                
                subpage.h1_tags.forEach(heading => {
                    const headingItem = document.createElement('li');
                    headingItem.textContent = heading;
                    headingsList.appendChild(headingItem);
                });
                
                // Add copy headings button
                const copyHeadingsButton = document.createElement('button');
                copyHeadingsButton.type = 'button';
                copyHeadingsButton.classList.add('action-button', 'small');
                copyHeadingsButton.textContent = 'Copy Headings';
                copyHeadingsButton.addEventListener('click', () => {
                    const headingsText = subpage.h1_tags.join('\n');
                    copyTextToClipboard(headingsText, copyHeadingsButton);
                });
                
                headingsSection.appendChild(headingsTitle);
                headingsSection.appendChild(headingsList);
                headingsSection.appendChild(copyHeadingsButton);
                content.appendChild(headingsSection);
            }
            
            // Add links with details
            if (subpage.links && subpage.links.length > 0) {
                const linksSection = document.createElement('div');
                linksSection.classList.add('subpage-section');
                
                const linksTitle = document.createElement('h4');
                linksTitle.textContent = 'Links';
                
                const linksCount = document.createElement('p');
                linksCount.textContent = `Found ${subpage.links.length} links`;
                
                const buttonControls = document.createElement('div');
                buttonControls.classList.add('button-controls');
                
                const toggleLinksButton = document.createElement('button');
                toggleLinksButton.type = 'button';
                toggleLinksButton.classList.add('toggle-button', 'small');
                toggleLinksButton.textContent = 'Show Links';
                
                const copyLinksButton = document.createElement('button');
                copyLinksButton.type = 'button';
                copyLinksButton.classList.add('action-button', 'small');
                copyLinksButton.textContent = 'Copy All Links';
                copyLinksButton.addEventListener('click', () => {
                    const linksText = subpage.links.map(link => `${link.text || 'Link'}: ${link.href}`).join('\n');
                    copyTextToClipboard(linksText, copyLinksButton);
                });
                
                buttonControls.appendChild(toggleLinksButton);
                buttonControls.appendChild(copyLinksButton);
                
                const linksList = document.createElement('ul');
                linksList.classList.add('subpage-list', 'hidden');
                
                // Limit to first 20 links to avoid overwhelming the UI
                const displayLinks = subpage.links.slice(0, 20);
                
                displayLinks.forEach(link => {
                    const linkItem = document.createElement('li');
                    
                    const linkAnchor = document.createElement('a');
                    linkAnchor.href = link.href;
                    linkAnchor.textContent = link.text || link.href;
                    linkAnchor.target = '_blank';
                    linkAnchor.rel = 'noopener noreferrer';
                    
                    linkItem.appendChild(linkAnchor);
                    linksList.appendChild(linkItem);
                });
                
                if (subpage.links.length > 20) {
                    const moreItem = document.createElement('li');
                    moreItem.textContent = `... and ${subpage.links.length - 20} more links`;
                    linksList.appendChild(moreItem);
                }
                
                toggleLinksButton.addEventListener('click', () => {
                    const isHidden = linksList.classList.contains('hidden');
                    if (isHidden) {
                        linksList.classList.remove('hidden');
                        toggleLinksButton.textContent = 'Hide Links';
                    } else {
                        linksList.classList.add('hidden');
                        toggleLinksButton.textContent = 'Show Links';
                    }
                });
                
                linksSection.appendChild(linksTitle);
                linksSection.appendChild(linksCount);
                linksSection.appendChild(buttonControls);
                linksSection.appendChild(linksList);
                content.appendChild(linksSection);
            }
            
            // Add images with details
            if (subpage.images && subpage.images.length > 0) {
                const imagesSection = document.createElement('div');
                imagesSection.classList.add('subpage-section');
                
                const imagesTitle = document.createElement('h4');
                imagesTitle.textContent = 'Images';
                
                const imagesCount = document.createElement('p');
                imagesCount.textContent = `Found ${subpage.images.length} images`;
                
                const buttonControls = document.createElement('div');
                buttonControls.classList.add('button-controls');
                
                const toggleImagesButton = document.createElement('button');
                toggleImagesButton.type = 'button';
                toggleImagesButton.classList.add('toggle-button', 'small');
                toggleImagesButton.textContent = 'Show Images';
                
                const copyImagesButton = document.createElement('button');
                copyImagesButton.type = 'button';
                copyImagesButton.classList.add('action-button', 'small');
                copyImagesButton.textContent = 'Copy Image URLs';
                copyImagesButton.addEventListener('click', () => {
                    const imagesText = subpage.images.map(image => `${image.alt || 'Image'}: ${image.src}`).join('\n');
                    copyTextToClipboard(imagesText, copyImagesButton);
                });
                
                buttonControls.appendChild(toggleImagesButton);
                buttonControls.appendChild(copyImagesButton);
                
                const imagesList = document.createElement('ul');
                imagesList.classList.add('subpage-list', 'hidden');
                
                // Limit to first 10 images
                const displayImages = subpage.images.slice(0, 10);
                
                displayImages.forEach(image => {
                    const imageItem = document.createElement('li');
                    
                    const imageInfo = document.createElement('div');
                    imageInfo.classList.add('image-info');
                    
                    const altText = document.createElement('p');
                    altText.innerHTML = `<strong>Alt text:</strong> ${image.alt || 'No alt text'}`;
                    
                    const srcText = document.createElement('p');
                    srcText.innerHTML = `<strong>Source:</strong> <a href="${image.src}" target="_blank" rel="noopener noreferrer">${image.src}</a>`;
                    
                    imageInfo.appendChild(altText);
                    imageInfo.appendChild(srcText);
                    imageItem.appendChild(imageInfo);
                    
                    imagesList.appendChild(imageItem);
                });
                
                if (subpage.images.length > 10) {
                    const moreItem = document.createElement('li');
                    moreItem.textContent = `... and ${subpage.images.length - 10} more images`;
                    imagesList.appendChild(moreItem);
                }
                
                toggleImagesButton.addEventListener('click', () => {
                    const isHidden = imagesList.classList.contains('hidden');
                    if (isHidden) {
                        imagesList.classList.remove('hidden');
                        toggleImagesButton.textContent = 'Hide Images';
                    } else {
                        imagesList.classList.add('hidden');
                        toggleImagesButton.textContent = 'Show Images';
                    }
                });
                
                imagesSection.appendChild(imagesTitle);
                imagesSection.appendChild(imagesCount);
                imagesSection.appendChild(buttonControls);
                imagesSection.appendChild(imagesList);
                content.appendChild(imagesSection);
            }
            
            // Nested subpages section removed as we no longer support depth > 1
            
            // Add all elements to subpage item
            subpageItem.appendChild(header);
            subpageItem.appendChild(content);
            
            // Add subpage item to subpages list
            subpagesList.appendChild(subpageItem);
        });
    }
    
    // Add keyboard accessibility
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            scraperForm.dispatchEvent(new Event('submit'));
        }
    });
}); 

// Helper function to copy text to clipboard
function copyTextToClipboard(text, buttonElement) {
    if (!text) return;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copied!';
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
        });
} 