# n8n Storybook Integration Guide

## Overview
This guide shows you how to use the interactive storybook HTML with your n8n workflow output.

## Your n8n Workflow Output Format
```json
{
  "total_pages": 8,
  "child_name": "Isabella",
  "status": "all_images_complete",
  "page_1_number": 1,
  "page_1_image_url": "https://tempfile.aiquickdraw.com/s/ff9f13b3d2514a5b01cd5b7fce06b421_0_1762758791_2512.png",
  "page_1_text": "Isabella woke up one beautiful morning...",
  "page_1_task_id": "ff9f13b3d2514a5b01cd5b7fce06b421",
  "page_1_status": "complete",
  "page_2_number": 2,
  "page_2_image_url": "https://tempfile.aiquickdraw.com/s/e94fc72ad36a160046259be1832aea6e_0_1762758797_7230.png",
  "page_2_text": "At school, Isabella greeted her teacher...",
  ...
}
```

## Method 1: Using URL Parameters (Recommended)

### In n8n:
1. After your "Merge All Results" node, add a **Code** node:

```javascript
const data = $input.first().json;

// Create the HTML file URL with encoded data
const baseUrl = 'http://your-domain.com/storybook-n8n.html';
const encodedData = encodeURIComponent(JSON.stringify(data));
const storybookUrl = `${baseUrl}?data=${encodedData}`;

return {
  json: {
    ...data,
    storybook_url: storybookUrl
  }
};
```

2. The output will include a `storybook_url` that you can:
   - Send via email
   - Display in a webhook response
   - Save to a database
   - Open in a browser

## Method 2: Using localStorage

### In n8n, add an HTML node at the end:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Storybook...</title>
</head>
<body>
  <h2>Generating your storybook...</h2>
  <script>
    const data = {{JSON.stringify($json)}};
    localStorage.setItem('storybook_data', JSON.stringify(data));
    window.location.href = 'http://your-domain.com/storybook-n8n.html';
  </script>
</body>
</html>
```

## Method 3: Embedding Data Directly

Create a custom HTML file that includes the data:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Your Storybook</title>
</head>
<body>
  <script>
    // Set the data before loading the storybook
    window.STORYBOOK_DATA = {
      "total_pages": 8,
      "child_name": "Isabella",
      "page_1_image_url": "...",
      "page_1_text": "...",
      // ... rest of your data
    };
  </script>
  <!-- Include the storybook iframe or embed -->
  <iframe src="storybook-n8n.html" style="width:100vw; height:100vh; border:none;"></iframe>
</body>
</html>
```

## Method 4: Using postMessage (For iframes)

If you're embedding the storybook in another page:

```html
<iframe id="storybook" src="storybook-n8n.html" style="width:100vw; height:100vh;"></iframe>

<script>
  const data = {
    // Your n8n workflow output
  };

  window.addEventListener('load', () => {
    const iframe = document.getElementById('storybook');
    iframe.contentWindow.postMessage({
      type: 'STORYBOOK_DATA',
      payload: data
    }, '*');
  });
</script>
```

## Testing Locally

1. Save your n8n workflow output to a file: `storybook-data.json`
2. Create a test HTML file:

```html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <script>
    fetch('storybook-data.json')
      .then(r => r.json())
      .then(data => {
        const url = `storybook-n8n.html?data=${encodeURIComponent(JSON.stringify(data))}`;
        window.location.href = url;
      });
  </script>
</body>
</html>
```

## n8n Workflow Addition

Add this **HTTP Request Node** at the end of your workflow to generate a shareable link:

**Node: Generate Storybook Link**
- Method: GET (just to pass data through)
- Add a Code node after "Merge All Results":

```javascript
const data = $input.first().json;

// Your server URL where storybook-n8n.html is hosted
const serverUrl = 'https://your-powernode-domain.com';
const encodedData = encodeURIComponent(JSON.stringify(data));

// Generate shareable URL (max 2000 chars for URL, may need to use alternative for large data)
const shortUrl = `${serverUrl}/storybook-n8n.html?data=${encodedData}`;

return {
  json: {
    success: true,
    message: 'Storybook generated successfully',
    child_name: data.child_name,
    total_pages: data.total_pages,
    storybook_url: shortUrl,
    // Include original data for reference
    ...data
  }
};
```

## Files Created

- `/public/storybook-n8n.html` - Dynamic storybook that accepts n8n data
- `/public/storybook.html` - Static example with hardcoded Isabella story
- This guide: `/public/n8n-storybook-integration.md`

## Next Steps

1. Deploy your PowerNode app (if not already deployed)
2. Note the public URL (e.g., `https://your-app.com`)
3. Update your n8n workflow to use: `https://your-app.com/storybook-n8n.html`
4. Test with your workflow data

## Example Final n8n Node

**HTTP Response Node** (if using webhook trigger):

```json
{
  "success": true,
  "storybook_url": "https://your-app.com/storybook-n8n.html?data=...",
  "message": "Storybook created for {{$json.child_name}}",
  "pages_generated": {{$json.total_pages}}
}
```
