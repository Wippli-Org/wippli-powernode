# PDF Viewer with Adobe Commenting

## Purpose
Embeds PDF documents from Azure Blob Storage with Adobe PDF Embed API, enabling commenting and annotation features.

## URL
`https://powernode.wippli.ai/pdf-viewer/`

## Usage
```
https://powernode.wippli.ai/pdf-viewer/?pdf=<URL>&name=<filename>
```

### Parameters
- `pdf` (required): URL-encoded PDF file URL from Azure Blob Storage
- `name` (optional): Display name for the PDF (defaults to "document.pdf")

### Example
```
https://powernode.wippli.ai/pdf-viewer/?pdf=https%3A%2F%2Fwipplipdfgen.blob.core.windows.net%2Fprologistik-wippli-999%2Fquestionnaire-test.pdf&name=questionnaire-test.pdf
```

## Features
- Adobe PDF Embed API with full commenting support
- Annotation tools enabled (sticky notes, highlights, text comments, drawing tools)
- **FIT_PAGE default view** - PDF automatically fits to page width
- Real-time annotation event tracking
- **Persistent Azure Blob Storage** - Annotations saved per wippli-id
- Auto-load existing annotations when PDF opens
- Automatic save (debounced 2 seconds after changes)
- Browser localStorage backup
- JavaScript APIs to retrieve and export annotations
- Download button
- Prologistik HUB branding

## Annotation Capture
The viewer automatically captures **ALL** annotation events:
- `ANNOTATION_ADDED` - When a new comment/annotation is created
- `ANNOTATION_UPDATED` - When an annotation is modified
- `ANNOTATION_DELETED` - When an annotation is removed
- `ANNOTATION_CLICKED` - When a user clicks on an annotation
- `ANNOTATION_SELECTED` - When an annotation is selected
- `ANNOTATION_UNSELECTED` - When an annotation is deselected
- `ANNOTATION_MOUSE_ENTER` - When mouse enters an annotation
- `ANNOTATION_MOUSE_LEAVE` - When mouse leaves an annotation

### Storage Architecture
1. **Azure Blob Storage (Primary)**: Permanent storage per wippli-id
   - API Endpoint: `/api/annotations?wippliId={id}&pdfName={name}`
   - Storage Location: `pdf-annotations/{wippli-id}/annotations.json`
   - Auto-saves 2 seconds after any annotation change (debounced)
   - Auto-loads existing annotations when PDF opens
   - Extracts wippli-id from PDF filename (e.g., `questionnaire-wippli-999.pdf` → `999`)

2. **localStorage (Backup)**: Browser-local storage for offline access
   - Event History: `pdf-annotations-{filename}` (all events)
   - Current Snapshot: `pdf-annotations-snapshot-{filename}` (includes wippli-id)

3. **Parent Window Messages**: Real-time updates posted to parent iframe (if embedded)

### JavaScript APIs
Open browser console and use:
```javascript
// Get wippli-id (extracted from PDF filename)
const wippliId = window.getWippliId();
console.log('Wippli ID:', wippliId);

// Get all current annotations (live from Adobe API)
window.getAnnotations().then(annotations => console.log(annotations));

// Manually save annotations to Azure immediately
window.saveAnnotations();

// Get latest snapshot from localStorage
const snapshot = window.getAnnotationSnapshot();
console.log(snapshot);

// Get full event history from localStorage
const history = window.getAnnotationHistory();
console.log(history);

// Export all annotations as JSON file (includes wippli-id)
window.exportAnnotations();
```

### Parent Window Integration
If embedded in an iframe, the viewer automatically:
1. Sends `PDF_VIEWER_READY` message when loaded
2. Sends `PDF_ANNOTATION_UPDATE` message on every annotation change
3. Responds to `REQUEST_PDF_ANNOTATIONS` messages with `PDF_ANNOTATIONS_RESPONSE`

Example parent window code:
```javascript
// Listen for annotation updates
window.addEventListener('message', function(event) {
    if (event.data.type === 'PDF_ANNOTATION_UPDATE') {
        console.log('Annotations updated:', event.data.annotations);
    }
});

// Request current annotations
iframe.contentWindow.postMessage({ type: 'REQUEST_PDF_ANNOTATIONS' }, '*');
```

## Configuration
- **Adobe Client ID**: `edeb93a6c51c4b1abd9c3d0001a784f2`
- **Registered Domain**: `powernode.wippli.ai` (enables commenting)
- **Embed Mode**: `FULL_WINDOW` (required for commenting tools)
- **Default View Mode**: `FIT_PAGE` (fits PDF to page width)
- **Tools Enabled**: Download, Print, Annotations, Comments
- **Storage**: Azure Blob Storage (`pdf-annotations` container)

## Integration
Used by n8n workflow **Neo_Responder** (ID: `Sp3MEuApPwENz2wO`) in the `merge all` node to display PDFs in WipBoard with commenting enabled.

## Why PowerNode Domain?
Adobe PDF Embed API requires the viewer to run on a registered domain (`*.wippli.ai`) to enable commenting features. Hosting on blob storage disables commenting.

---
Generated: 2025-12-05
